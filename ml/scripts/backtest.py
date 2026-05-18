from __future__ import annotations

import argparse
import json
import logging
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from accounts_config import ML_ROOT, PUBLIC_DATA, load_accounts  # noqa: E402
from features import build_daily_features, build_supervised  # noqa: E402
from train_models import HORIZONS, build_prophet  # noqa: E402

MODEL_VERSION = "sight-v2"
EVAL_HORIZONS = [1, 3, 7, 14]
DEFAULT_INITIAL_DAYS = 120
DEFAULT_PERIOD_DAYS = 3
DEFAULT_HORIZON_DAYS = 14


def silence_prophet() -> None:
    warnings.filterwarnings("ignore")
    for name in ("cmdstanpy", "prophet", "prophet.plot", "prophet.models"):
        logging.getLogger(name).setLevel(logging.ERROR)


def safe_mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    eps = 1.0
    denom = np.maximum(np.abs(y_true), eps)
    return float(np.mean(np.abs((y_true - y_pred) / denom)) * 100.0)


def baselines_for_cutoff(
    history: pd.DataFrame,
    cutoff: pd.Timestamp,
    horizons: list[int],
) -> dict[int, dict[str, float]]:
    out: dict[int, dict[str, float]] = {}
    history = history.sort_values("ds").reset_index(drop=True)
    train = history[history["ds"] <= cutoff]
    if train.empty:
        return out
    last_value = float(train["y"].iloc[-1])
    ma_7 = float(train["y"].tail(7).mean())
    for h in horizons:
        target_date = cutoff + pd.Timedelta(days=h)
        target_row = history[history["ds"] == target_date]
        if target_row.empty:
            continue
        y_true = float(target_row["y"].iloc[0])
        seasonal_date = target_date - pd.Timedelta(days=7)
        seasonal_row = history[history["ds"] == seasonal_date]
        seasonal = float(seasonal_row["y"].iloc[0]) if not seasonal_row.empty else last_value
        out[h] = {
            "y_true": y_true,
            "naive": last_value,
            "ma_7": ma_7,
            "seasonal_naive": seasonal,
        }
    return out


def prophet_cv(
    df: pd.DataFrame,
    country: str | None,
    initial_days: int,
    period_days: int,
    horizon_days: int,
):
    from prophet.diagnostics import cross_validation

    model = build_prophet(country)
    model.fit(df)
    cv = cross_validation(
        model,
        initial=f"{initial_days} days",
        period=f"{period_days} days",
        horizon=f"{horizon_days} days",
        parallel=None,
        disable_tqdm=True,
    )
    return cv


def lightgbm_walkforward(
    account_id: str,
    daily_all: pd.DataFrame,
    accounts_meta: dict[str, dict],
    cutoffs: list[pd.Timestamp],
    horizons: list[int],
) -> pd.DataFrame:
    """For each cutoff, retrain LightGBM on data <= cutoff and predict at horizons."""
    import lightgbm as lgb

    rows: list[dict] = []
    daily_all = daily_all.copy()
    daily_all["date"] = pd.to_datetime(daily_all["date"])

    for cutoff in cutoffs:
        cutoff = pd.Timestamp(cutoff).normalize()
        train_daily = daily_all[daily_all["date"] <= cutoff].copy()
        if train_daily[train_daily["account_id"] == account_id].shape[0] < 40:
            continue

        features = build_daily_features(train_daily, accounts_meta)
        supervised, feature_cols = build_supervised(features, HORIZONS)
        supervised = supervised[supervised["account_id"] == account_id]
        if supervised.empty:
            continue
        X = supervised[feature_cols].to_numpy(dtype=float)
        y = supervised["target"].to_numpy(dtype=float)

        models: dict[float, "lgb.Booster"] = {}
        for q in (0.1, 0.5, 0.9):
            ds = lgb.Dataset(X, label=y, free_raw_data=False)
            params = {
                "objective": "quantile",
                "alpha": q,
                "metric": "quantile",
                "learning_rate": 0.05,
                "num_leaves": 31,
                "min_data_in_leaf": 8,
                "feature_fraction": 0.85,
                "bagging_fraction": 0.85,
                "bagging_freq": 4,
                "lambda_l2": 1.0,
                "verbosity": -1,
            }
            models[q] = lgb.train(params, ds, num_boost_round=300, callbacks=[lgb.log_evaluation(0)])

        last_features_row = features[
            (features["account_id"] == account_id) & (features["date"] == cutoff.date())
        ]
        if last_features_row.empty:
            continue
        base_row = last_features_row.iloc[0]

        for h in horizons:
            target_date = cutoff + pd.Timedelta(days=h)
            truth = daily_all[
                (daily_all["account_id"] == account_id) & (daily_all["date"] == target_date)
            ]
            if truth.empty:
                continue
            X_row = []
            for c in feature_cols:
                X_row.append(float(h) if c == "horizon" else float(base_row[c]))
            X_eval = np.array([X_row])
            rows.append(
                {
                    "cutoff": cutoff,
                    "ds": target_date,
                    "lag_days": h,
                    "y": float(truth["balance"].iloc[0]),
                    "yhat": float(models[0.5].predict(X_eval)[0]),
                    "yhat_lower": float(models[0.1].predict(X_eval)[0]),
                    "yhat_upper": float(models[0.9].predict(X_eval)[0]),
                }
            )

    if not rows:
        return pd.DataFrame(columns=["cutoff", "ds", "lag_days", "y", "yhat", "yhat_lower", "yhat_upper"])
    return pd.DataFrame(rows)


def coverage(cv: pd.DataFrame) -> float:
    if cv.empty:
        return 0.0
    within = (cv["y"] >= cv["yhat_lower"]) & (cv["y"] <= cv["yhat_upper"])
    return float(within.mean())


def deficit_metrics(cv: pd.DataFrame, min_balance: float) -> tuple[int, int, int, int]:
    if cv.empty or min_balance <= 0:
        return (0, 0, 0, 0)
    actual = cv["y"] < min_balance
    predicted = cv["yhat"] < min_balance
    tp = int((actual & predicted).sum())
    fp = int((~actual & predicted).sum())
    fn = int((actual & ~predicted).sum())
    tn = int((~actual & ~predicted).sum())
    return tp, fp, fn, tn


def actual_vs_predicted(cv: pd.DataFrame, horizon: int = 1, last_n: int = 30) -> list[dict]:
    sub = cv[cv["lag_days"] == horizon].copy().sort_values("ds")
    sub = sub.tail(last_n)
    return [
        {
            "date": pd.Timestamp(row["ds"]).date().isoformat(),
            "actual": round(float(row["y"]), 2),
            "predicted": round(float(row["yhat"]), 2),
            "p10": round(float(row["yhat_lower"]), 2),
            "p90": round(float(row["yhat_upper"]), 2),
        }
        for _, row in sub.iterrows()
    ]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--daily", type=str, default=str(ML_ROOT / "data" / "daily_balances.parquet")
    )
    parser.add_argument(
        "--selection", type=str, default=str(ML_ROOT / "models" / "selection.json")
    )
    parser.add_argument(
        "--output", type=str, default=str(PUBLIC_DATA / "backtest_results.json")
    )
    parser.add_argument("--initial-days", type=int, default=DEFAULT_INITIAL_DAYS)
    parser.add_argument("--period-days", type=int, default=DEFAULT_PERIOD_DAYS)
    parser.add_argument("--horizon-days", type=int, default=DEFAULT_HORIZON_DAYS)
    args = parser.parse_args()

    silence_prophet()
    daily = pd.read_parquet(args.daily)
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

    selections: dict[str, dict] = {}
    selection_path = Path(args.selection)
    if selection_path.exists():
        selections = json.loads(selection_path.read_text())

    horizon_truth: dict[int, dict[str, list[float]]] = {
        h: {"y_true": [], "sight": [], "naive": [], "ma_7": [], "seasonal_naive": []}
        for h in EVAL_HORIZONS
    }
    per_account_metrics: list[dict] = []
    actual_vs_pred_payload: dict[str, list[dict]] = {}
    deficit_total = {"tp": 0, "fp": 0, "fn": 0, "tn": 0}
    coverage_samples: list[float] = []

    for account in accounts:
        sub = daily[daily["account_id"] == account.id].copy()
        if sub.empty:
            continue
        sub["ds"] = pd.to_datetime(sub["date"])
        sub["y"] = sub["balance"].astype(float)
        sub = sub[["ds", "y"]].sort_values("ds").reset_index(drop=True)
        if len(sub) <= args.initial_days + args.horizon_days:
            print(f"  {account.id}: not enough data, skipping")
            continue

        chosen = selections.get(account.id, {}).get("chosen", "prophet")
        print(f"  {account.id}: backtesting ({chosen})…")

        cv_prophet = prophet_cv(
            sub, account.country_for_holidays,
            args.initial_days, args.period_days, args.horizon_days,
        )

        if chosen == "lightgbm":
            cutoffs = sorted(cv_prophet["cutoff"].unique())
            cv_lgb = lightgbm_walkforward(
                account.id, daily, accounts_meta,
                [pd.Timestamp(c) for c in cutoffs],
                list(range(1, args.horizon_days + 1)),
            )
            cv = cv_lgb if not cv_lgb.empty else cv_prophet
        else:
            cv = cv_prophet
            cv["lag_days"] = (cv["ds"] - cv["cutoff"]).dt.days

        cov = coverage(cv)
        coverage_samples.append(cov)

        for h in EVAL_HORIZONS:
            sub_h = cv[cv["lag_days"] == h]
            if sub_h.empty:
                continue
            horizon_truth[h]["y_true"].extend(sub_h["y"].tolist())
            horizon_truth[h]["sight"].extend(sub_h["yhat"].tolist())

        cutoffs = cv["cutoff"].unique()
        for cutoff in cutoffs:
            baselines = baselines_for_cutoff(sub, pd.Timestamp(cutoff), EVAL_HORIZONS)
            for h, vals in baselines.items():
                horizon_truth[h]["naive"].append(vals["naive"])
                horizon_truth[h]["ma_7"].append(vals["ma_7"])
                horizon_truth[h]["seasonal_naive"].append(vals["seasonal_naive"])

        cv_h7 = cv[cv["lag_days"] == 7]
        mape_7d = (
            safe_mape(cv_h7["y"].to_numpy(), cv_h7["yhat"].to_numpy())
            if not cv_h7.empty
            else 0.0
        )

        tp, fp, fn, tn = deficit_metrics(cv, account.min_balance)
        deficit_total["tp"] += tp
        deficit_total["fp"] += fp
        deficit_total["fn"] += fn
        deficit_total["tn"] += tn

        per_account_metrics.append(
            {
                "account_id": account.id,
                "model": chosen,
                "mape_7d": round(mape_7d, 2),
                "coverage_p10_p90": round(cov, 3),
                "cutoffs": int(len(cutoffs)),
            }
        )
        actual_vs_pred_payload[account.id] = actual_vs_predicted(cv, horizon=7, last_n=30)

    horizons_payload: list[dict] = []
    n_pairs = 0
    for h in EVAL_HORIZONS:
        bucket = horizon_truth[h]
        y_true = np.asarray(bucket["y_true"])
        if y_true.size == 0:
            continue
        n_pairs += int(y_true.size)
        sight_pred = np.asarray(bucket["sight"])
        n = min(y_true.size, sight_pred.size)
        y_true = y_true[:n]
        sight_pred = sight_pred[:n]
        naive_pred = np.asarray(bucket["naive"][:n])
        ma_7_pred = np.asarray(bucket["ma_7"][:n])
        sn_pred = np.asarray(bucket["seasonal_naive"][:n])
        horizons_payload.append(
            {
                "days": h,
                "sight_mape": round(safe_mape(y_true, sight_pred), 2),
                "naive_mape": round(safe_mape(y_true, naive_pred), 2) if naive_pred.size else None,
                "moving_avg_mape": round(safe_mape(y_true, ma_7_pred), 2) if ma_7_pred.size else None,
                "seasonal_naive_mape": round(safe_mape(y_true, sn_pred), 2) if sn_pred.size else None,
            }
        )

    tp = deficit_total["tp"]
    fp = deficit_total["fp"]
    fn = deficit_total["fn"]
    tn = deficit_total["tn"]
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    empirical_coverage = float(np.mean(coverage_samples)) if coverage_samples else 0.0

    payload = {
        "model_version": MODEL_VERSION,
        "evaluated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "horizons": horizons_payload,
        "per_account": per_account_metrics,
        "deficit_detection": {
            "precision": round(precision, 3),
            "recall": round(recall, 3),
            "f1": round(f1, 3),
            "tp": tp, "fp": fp, "fn": fn, "tn": tn,
        },
        "calibration": {
            "nominal_coverage": 0.80,
            "empirical_coverage": round(empirical_coverage, 3),
            "delta": round(empirical_coverage - 0.80, 3),
        },
        "impact": {
            "overdrafts_without_sight": int(tp + fn),
            "overdrafts_with_sight": int(fn),
            "deficit_pairs_observed": int(tp + fp + fn + tn),
        },
        "actual_vs_predicted_h7": actual_vs_pred_payload,
        "summary": {
            "pairs_evaluated": n_pairs,
            "accounts_evaluated": len(per_account_metrics),
        },
    }

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2))
    print(f"Wrote {out_path}")
    print(f"Empirical coverage: {empirical_coverage:.3f} (nominal 0.80)")
    print(f"Deficit detection: P={precision:.2f} R={recall:.2f} F1={f1:.2f}")
    for entry in horizons_payload:
        print(
            f"  h={entry['days']}d  sight={entry['sight_mape']:>6}%  "
            f"naive={entry['naive_mape']}%  ma7={entry['moving_avg_mape']}%  "
            f"sn={entry['seasonal_naive_mape']}%"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
