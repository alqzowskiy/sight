"""Train Prophet + LightGBM + ARIMA + ETS + Chronos, plus a Ridge stacking meta-learner.

The stacker is trained on rolling-origin OUT-OF-FOLD predictions collected from
windows BEFORE the test cutoff, then evaluated on the held-out test window that
nothing else has seen. This makes the reported stacker MAPE honest (vs. the
earlier in-sample setup where Ridge was fit and scored on the same 30 days).

Outputs:
  models/{account}_prophet.pkl
  models/{account}_lightgbm.pkl
  models/{account}_arima.pkl
  models/{account}_ets.pkl
  models/chronos_pipeline.pkl  (shared)
  models/{account}_stacker.pkl    (now includes OOF metadata)
  models/selection.json           (best model per account on the test window)

Runtime note: collecting OOF data multiplies base-model fittings by
(--oof-windows + 1) per account. Default 5 windows × 11 accounts is heavy.
Pass --oof-windows 3 --skip-chronos for a faster iteration loop.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge

sys.path.insert(0, str(Path(__file__).resolve().parent))
from accounts_config import ML_ROOT, load_accounts  # noqa: E402
from extra_models import (  # noqa: E402
    fit_arima,
    fit_ets,
    load_chronos_pipeline,
    predict_arima,
    predict_chronos,
    predict_ets,
)
from train_models import (  # noqa: E402
    HORIZONS,
    fit_prophet,
    train_lightgbm_for_account,
)
from inference import predict_lightgbm, predict_prophet  # noqa: E402

HOLDOUT_DAYS = 30
EVAL_HORIZON = 7
BASE_MODEL_NAMES = ("prophet", "lightgbm", "arima", "ets", "chronos")

# Rolling-origin out-of-fold params for honest stacker training.
# OOF windows sit STRICTLY BEFORE the test window (last HOLDOUT_DAYS days).
# Each window trains the base models on data <= window_cutoff, then predicts
# STACK_HORIZON days forward. Stacker is trained on the concatenation of all
# OOF (predictions, actuals) pairs, and evaluated on the held-out test window
# that nothing else has seen.
OOF_WINDOWS = 5
STACK_HORIZON = 7


def silence_logs() -> None:
    warnings.filterwarnings("ignore")
    for name in ("cmdstanpy", "prophet", "prophet.plot", "prophet.models", "statsmodels"):
        logging.getLogger(name).setLevel(logging.ERROR)


def safe_mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    eps = 1.0
    denom = np.maximum(np.abs(y_true), eps)
    return float(np.mean(np.abs((y_true - y_pred) / denom)) * 100.0)


def _fit_predict_all(
    daily_train: pd.DataFrame,
    account,
    accounts_meta: dict[str, dict],
    chronos_pipeline,
    horizon: int,
) -> dict[str, np.ndarray]:
    """Internal: train all 5 base models on `daily_train` and predict `horizon` days.

    `daily_train` should be pre-filtered to date <= cutoff for the desired window.
    Returns {model_name: ndarray(horizon)}.
    """
    df_train = daily_train[daily_train["account_id"] == account.id].copy()
    df_train["date"] = pd.to_datetime(df_train["date"])
    df_train = df_train.sort_values("date").reset_index(drop=True)

    preds: dict[str, np.ndarray] = {}
    horizons = list(range(1, horizon + 1))

    try:
        prophet_model = fit_prophet(df_train, account.country_for_holidays)
        last_date = df_train["date"].iloc[-1]
        p_fc = predict_prophet(prophet_model, pd.Timestamp(last_date), horizon)
        preds["prophet"] = p_fc["balance"].to_numpy()
    except Exception as e:
        print(f"    prophet failed: {e}")
        preds["prophet"] = np.full(horizon, np.nan)

    try:
        lgb_bundle, _ = train_lightgbm_for_account(daily_train, accounts_meta)
        if lgb_bundle is not None:
            l_fc = predict_lightgbm(
                lgb_bundle,
                df_train.assign(account_id=account.id),
                accounts_meta,
                horizons,
                daily_all=daily_train,
            )
            preds["lightgbm"] = l_fc["balance"].to_numpy()
        else:
            preds["lightgbm"] = np.full(horizon, np.nan)
    except Exception as e:
        print(f"    lightgbm failed: {e}")
        preds["lightgbm"] = np.full(horizon, np.nan)

    try:
        arima_bundle = fit_arima(df_train)
        a_fc = predict_arima(arima_bundle, horizon)
        preds["arima"] = a_fc["balance"].to_numpy()
    except Exception as e:
        print(f"    arima failed: {e}")
        preds["arima"] = np.full(horizon, np.nan)

    try:
        ets_bundle = fit_ets(df_train)
        e_fc = predict_ets(ets_bundle, horizon)
        preds["ets"] = e_fc["balance"].to_numpy()
    except Exception as e:
        print(f"    ets failed: {e}")
        preds["ets"] = np.full(horizon, np.nan)

    if chronos_pipeline is not None:
        try:
            c_fc = predict_chronos(chronos_pipeline, df_train, horizon, num_samples=20)
            preds["chronos"] = c_fc["balance"].to_numpy()
        except Exception as e:
            print(f"    chronos failed: {e}")
            preds["chronos"] = np.full(horizon, np.nan)
    else:
        preds["chronos"] = np.full(horizon, np.nan)

    return preds


def model_predictions_horizon(
    daily_train: pd.DataFrame,
    daily_full: pd.DataFrame,
    account,
    accounts_meta: dict[str, dict],
    chronos_pipeline,
) -> dict[str, np.ndarray]:
    """Train base models on `daily_train` then forecast HOLDOUT_DAYS days."""
    _ = daily_full  # kept for backward compatibility
    return _fit_predict_all(
        daily_train, account, accounts_meta, chronos_pipeline, HOLDOUT_DAYS
    )


def collect_oof_data(
    daily: pd.DataFrame,
    oof_end_cutoff: pd.Timestamp,
    account,
    accounts_meta: dict[str, dict],
    chronos_pipeline,
    n_windows: int,
    horizon: int,
) -> tuple[dict[str, list[np.ndarray]], list[np.ndarray]]:
    """Rolling-origin OOF predictions used to train the stacker.

    For each i in [0, n_windows): cutoff = oof_end_cutoff - (n_windows - i) * horizon.
    Train all base models on daily[date <= cutoff], predict `horizon` days forward,
    record (predictions, actuals).

    Returns (oof_preds_per_model, oof_truth_per_window) where:
      oof_preds_per_model[model_name] = list of ndarray(horizon), one per window
      oof_truth_per_window            = list of ndarray(horizon), one per window
    """
    oof_preds: dict[str, list[np.ndarray]] = {name: [] for name in BASE_MODEL_NAMES}
    oof_truth: list[np.ndarray] = []

    truth_full = daily[daily["account_id"] == account.id].copy()
    truth_full["date"] = pd.to_datetime(truth_full["date"])
    truth_full = truth_full.sort_values("date").reset_index(drop=True)

    for i in range(n_windows):
        window_cutoff = oof_end_cutoff - pd.Timedelta(
            days=(n_windows - i) * horizon
        )

        daily_window_train = daily[daily["date"] <= window_cutoff]
        if daily_window_train.empty:
            continue

        # Need horizon days of truth strictly after window_cutoff
        eval_slice = truth_full[
            (truth_full["date"] > window_cutoff)
            & (
                truth_full["date"]
                <= window_cutoff + pd.Timedelta(days=horizon)
            )
        ]
        if len(eval_slice) < horizon:
            continue

        print(f"    OOF window {i + 1}/{n_windows} (cutoff {window_cutoff.date()})")
        preds = _fit_predict_all(
            daily_window_train, account, accounts_meta, chronos_pipeline, horizon
        )
        y_eval = eval_slice["balance"].astype(float).to_numpy()[:horizon]

        oof_truth.append(y_eval)
        for name in BASE_MODEL_NAMES:
            arr = preds.get(name, np.full(horizon, np.nan))
            oof_preds[name].append(arr)

    return oof_preds, oof_truth


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--daily", type=str, default=str(ML_ROOT / "data" / "daily_balances.parquet")
    )
    parser.add_argument("--models-dir", type=str, default=str(ML_ROOT / "models"))
    parser.add_argument(
        "--selection", type=str, default=str(ML_ROOT / "models" / "selection.json")
    )
    parser.add_argument("--holdout-days", type=int, default=HOLDOUT_DAYS)
    parser.add_argument("--oof-windows", type=int, default=OOF_WINDOWS)
    parser.add_argument("--stack-horizon", type=int, default=STACK_HORIZON)
    parser.add_argument("--skip-chronos", action="store_true")
    args = parser.parse_args()

    silence_logs()

    from joblib import dump as joblib_dump

    models_dir = Path(args.models_dir)
    models_dir.mkdir(parents=True, exist_ok=True)

    daily = pd.read_parquet(args.daily)
    daily["date"] = pd.to_datetime(daily["date"])
    accounts = load_accounts()
    accounts_meta = {
        a.id: {
            "currency": a.currency,
            "type": a.type,
            "min_balance": a.min_balance,
            "country_for_holidays": a.country_for_holidays,
        }
        for a in accounts
    }

    cutoff_date = daily["date"].max() - pd.Timedelta(days=args.holdout_days)
    daily_train_only = daily[daily["date"] <= cutoff_date].copy()
    print(f"Holdout: training on dates <= {cutoff_date.date()} ({len(daily_train_only)} rows).")

    print("Loading Chronos pipeline…")
    chronos_pipeline = None if args.skip_chronos else load_chronos_pipeline()
    if chronos_pipeline is not None:
        print("  Chronos loaded")

    selections: dict[str, dict] = {}

    for account in accounts:
        print(
            f"  {account.id}: base preds on test window + {args.oof_windows}"
            f"x{args.stack_horizon}d OOF for stacker…"
        )
        preds_h = model_predictions_horizon(
            daily_train_only,
            daily,
            account,
            accounts_meta,
            chronos_pipeline,
        )

        truth = daily[daily["account_id"] == account.id].copy()
        truth["date"] = pd.to_datetime(truth["date"])
        truth = truth.sort_values("date").reset_index(drop=True)
        holdout = truth[truth["date"] > cutoff_date].copy()
        if len(holdout) < args.holdout_days:
            print(f"    holdout too short ({len(holdout)}), skipping")
            continue
        y_true = holdout["balance"].astype(float).to_numpy()

        # Per-model MAPE at h=EVAL_HORIZON (single-day horizon = day 7 of holdout)
        per_model_mape: dict[str, float] = {}
        for name in BASE_MODEL_NAMES:
            arr = preds_h.get(name, np.full(args.holdout_days, np.nan))
            valid = np.isfinite(arr) & np.isfinite(y_true)
            if not valid.any():
                per_model_mape[name] = float("inf")
                continue
            per_model_mape[name] = safe_mape(y_true[valid], arr[valid])

        # Stack: only use models that produced finite predictions on the
        # test window. We then train Ridge on rolling-origin OOF predictions
        # collected from BEFORE the test cutoff (no leakage) and evaluate
        # the stacker on the held-out test window — gives an honest stack MAPE.
        usable_models = [
            name for name in BASE_MODEL_NAMES
            if np.isfinite(preds_h[name]).all()
        ]
        stack_mape = float("inf")
        if len(usable_models) >= 2:
            oof_preds, oof_truth = collect_oof_data(
                daily,
                oof_end_cutoff=cutoff_date,
                account=account,
                accounts_meta=accounts_meta,
                chronos_pipeline=chronos_pipeline,
                n_windows=args.oof_windows,
                horizon=args.stack_horizon,
            )

            # Keep only models with finite OOF predictions in every window
            stackable = [
                name
                for name in usable_models
                if len(oof_preds[name]) == len(oof_truth)
                and len(oof_truth) >= 2
                and all(np.isfinite(arr).all() for arr in oof_preds[name])
            ]

            if len(stackable) >= 2 and len(oof_truth) >= 2:
                X_oof = np.column_stack(
                    [np.concatenate(oof_preds[name]) for name in stackable]
                )
                y_oof = np.concatenate(oof_truth)
                oof_mask = np.isfinite(y_oof) & np.all(
                    np.isfinite(X_oof), axis=1
                )

                if oof_mask.sum() >= len(stackable) + 2:
                    ridge = Ridge(alpha=1.0, fit_intercept=True, positive=True)
                    ridge.fit(X_oof[oof_mask], y_oof[oof_mask])

                    # Honest test eval — base preds on test window unseen by ridge
                    X_test = np.column_stack(
                        [preds_h[name] for name in stackable]
                    )
                    test_mask = np.isfinite(y_true) & np.all(
                        np.isfinite(X_test), axis=1
                    )
                    if test_mask.sum() >= 1:
                        stack_pred_test = ridge.predict(X_test[test_mask])
                        stack_mape = safe_mape(
                            y_true[test_mask], stack_pred_test
                        )

                    stack_path = models_dir / f"{account.id}_stacker.pkl"
                    joblib_dump(
                        {
                            "ridge": ridge,
                            "base_models": stackable,
                            "coefficients": ridge.coef_.tolist(),
                            "intercept": float(ridge.intercept_),
                            "oof_windows": len(oof_truth),
                            "oof_pairs": int(oof_mask.sum()),
                            "test_mape": (
                                float(stack_mape)
                                if stack_mape != float("inf")
                                else None
                            ),
                            "training": "rolling-origin OOF",
                        },
                        stack_path,
                    )
                    print(
                        f"    stacker · OOF pairs={int(oof_mask.sum())}"
                        f" · test MAPE={stack_mape:.2f}%"
                    )

        candidates = dict(per_model_mape)
        candidates["stacker"] = stack_mape
        chosen = min(candidates, key=lambda k: candidates[k])
        selections[account.id] = {
            "chosen": chosen,
            "mape": {k: round(v, 2) if v != float("inf") else None for k, v in candidates.items()},
        }
        formatted = "  ".join(
            f"{k}={v:.2f}" if v != float("inf") else f"{k}=---"
            for k, v in candidates.items()
        )
        print(f"    {formatted}  -> {chosen}")

    print("\nFitting final production models on ALL data…")

    for account in accounts:
        sub = daily[daily["account_id"] == account.id].copy()
        sub["date"] = pd.to_datetime(sub["date"])
        sub = sub.sort_values("date").reset_index(drop=True)
        if sub.empty:
            continue

        try:
            prophet_model = fit_prophet(sub, account.country_for_holidays)
            joblib_dump(prophet_model, models_dir / f"{account.id}_prophet.pkl")
        except Exception as e:
            print(f"  {account.id} prophet final: {e}")

        try:
            lgb_bundle, _ = train_lightgbm_for_account(daily, accounts_meta)
            if lgb_bundle is not None:
                joblib_dump(lgb_bundle, models_dir / f"{account.id}_lightgbm.pkl")
        except Exception as e:
            print(f"  {account.id} lightgbm final: {e}")

        try:
            arima_bundle = fit_arima(sub)
            joblib_dump(arima_bundle, models_dir / f"{account.id}_arima.pkl")
        except Exception as e:
            print(f"  {account.id} arima final: {e}")

        try:
            ets_bundle = fit_ets(sub)
            joblib_dump(ets_bundle, models_dir / f"{account.id}_ets.pkl")
        except Exception as e:
            print(f"  {account.id} ets final: {e}")

        print(f"  {account.id}: final models saved")

    selection_path = Path(args.selection)
    selection_path.write_text(json.dumps(selections, indent=2))
    print(f"\nWrote {selection_path}")
    counts: dict[str, int] = {}
    for v in selections.values():
        counts[v["chosen"]] = counts.get(v["chosen"], 0) + 1
    print(f"Selection: {counts}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
