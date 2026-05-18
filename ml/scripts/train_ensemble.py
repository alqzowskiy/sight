"""Train Prophet + LightGBM + ARIMA + ETS + Chronos, plus a Ridge stacking meta-learner.

Outputs:
  models/{account}_prophet.pkl
  models/{account}_lightgbm.pkl
  models/{account}_arima.pkl
  models/{account}_ets.pkl
  models/chronos_pipeline.pkl  (shared)
  models/{account}_stacker.pkl
  models/selection.json        (best model per account on holdout)
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


def silence_logs() -> None:
    warnings.filterwarnings("ignore")
    for name in ("cmdstanpy", "prophet", "prophet.plot", "prophet.models", "statsmodels"):
        logging.getLogger(name).setLevel(logging.ERROR)


def safe_mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    eps = 1.0
    denom = np.maximum(np.abs(y_true), eps)
    return float(np.mean(np.abs((y_true - y_pred) / denom)) * 100.0)


def model_predictions_horizon(
    daily_train: pd.DataFrame,
    daily_full: pd.DataFrame,
    account,
    accounts_meta: dict[str, dict],
    chronos_pipeline,
) -> dict[str, np.ndarray]:
    """Train base models on `daily_train` then forecast HOLDOUT_DAYS days.

    Returns dict {model_name: predictions_array (length HOLDOUT_DAYS)}.
    """
    df_train = daily_train[daily_train["account_id"] == account.id].copy()
    df_train["date"] = pd.to_datetime(df_train["date"])
    df_train = df_train.sort_values("date").reset_index(drop=True)

    preds: dict[str, np.ndarray] = {}
    horizons = list(range(1, HOLDOUT_DAYS + 1))

    try:
        prophet_model = fit_prophet(df_train.rename(columns={"date": "date", "balance": "balance"}), account.country_for_holidays)
        last_date = df_train["date"].iloc[-1]
        p_fc = predict_prophet(prophet_model, pd.Timestamp(last_date), HOLDOUT_DAYS)
        preds["prophet"] = p_fc["balance"].to_numpy()
    except Exception as e:
        print(f"    prophet failed: {e}")
        preds["prophet"] = np.full(HOLDOUT_DAYS, np.nan)

    try:
        lgb_bundle, _ = train_lightgbm_for_account(daily_train, accounts_meta)
        if lgb_bundle is not None:
            sub = daily_train.copy()
            sub["account_id"] = sub["account_id"]
            l_fc = predict_lightgbm(
                lgb_bundle,
                df_train.assign(account_id=account.id),
                accounts_meta,
                horizons,
                daily_all=daily_train,
            )
            preds["lightgbm"] = l_fc["balance"].to_numpy()
        else:
            preds["lightgbm"] = np.full(HOLDOUT_DAYS, np.nan)
    except Exception as e:
        print(f"    lightgbm failed: {e}")
        preds["lightgbm"] = np.full(HOLDOUT_DAYS, np.nan)

    try:
        arima_bundle = fit_arima(df_train)
        a_fc = predict_arima(arima_bundle, HOLDOUT_DAYS)
        preds["arima"] = a_fc["balance"].to_numpy()
    except Exception as e:
        print(f"    arima failed: {e}")
        preds["arima"] = np.full(HOLDOUT_DAYS, np.nan)

    try:
        ets_bundle = fit_ets(df_train)
        e_fc = predict_ets(ets_bundle, HOLDOUT_DAYS)
        preds["ets"] = e_fc["balance"].to_numpy()
    except Exception as e:
        print(f"    ets failed: {e}")
        preds["ets"] = np.full(HOLDOUT_DAYS, np.nan)

    if chronos_pipeline is not None:
        try:
            c_fc = predict_chronos(chronos_pipeline, df_train, HOLDOUT_DAYS, num_samples=20)
            preds["chronos"] = c_fc["balance"].to_numpy()
        except Exception as e:
            print(f"    chronos failed: {e}")
            preds["chronos"] = np.full(HOLDOUT_DAYS, np.nan)
    else:
        preds["chronos"] = np.full(HOLDOUT_DAYS, np.nan)

    return preds


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
        print(f"  {account.id}: training 5 base models + stacker on holdout…")
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

        # Stack: only use models that produced finite predictions
        usable_models = [
            name for name in BASE_MODEL_NAMES
            if np.isfinite(preds_h[name]).all()
        ]
        if len(usable_models) >= 2:
            X = np.column_stack([preds_h[name] for name in usable_models])
            mask = np.isfinite(y_true)
            if mask.sum() >= len(usable_models) + 2:
                ridge = Ridge(alpha=1.0, fit_intercept=True, positive=True)
                ridge.fit(X[mask], y_true[mask])
                stack_pred = ridge.predict(X[mask])
                stack_mape = safe_mape(y_true[mask], stack_pred)
                stack_path = models_dir / f"{account.id}_stacker.pkl"
                joblib_dump(
                    {
                        "ridge": ridge,
                        "base_models": usable_models,
                        "coefficients": ridge.coef_.tolist(),
                        "intercept": float(ridge.intercept_),
                    },
                    stack_path,
                )
            else:
                stack_mape = float("inf")
        else:
            stack_mape = float("inf")

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
