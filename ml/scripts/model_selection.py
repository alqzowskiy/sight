from __future__ import annotations

import argparse
import json
import logging
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from accounts_config import ML_ROOT, load_accounts  # noqa: E402
from features import build_daily_features, build_supervised  # noqa: E402
from train_models import HORIZONS, QUANTILES, build_prophet  # noqa: E402

HOLDOUT_DAYS = 30
EVAL_HORIZONS = [1, 3, 7, 14]
SELECTION_HORIZON = 7


def silence_logs() -> None:
    warnings.filterwarnings("ignore")
    for name in ("cmdstanpy", "prophet", "prophet.plot", "prophet.models"):
        logging.getLogger(name).setLevel(logging.ERROR)


def safe_mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    eps = 1.0
    denom = np.maximum(np.abs(y_true), eps)
    return float(np.mean(np.abs((y_true - y_pred) / denom)) * 100.0)


def evaluate_prophet(
    daily_for_account: pd.DataFrame,
    country: str | None,
    holdout_days: int,
) -> dict[int, float]:
    df = daily_for_account[["date", "balance"]].copy()
    df["ds"] = pd.to_datetime(df["date"])
    df["y"] = df["balance"].astype(float)
    df = df[["ds", "y"]].sort_values("ds").reset_index(drop=True)
    if len(df) <= holdout_days + 30:
        return {}

    train = df.iloc[:-holdout_days].copy()
    test = df.iloc[-holdout_days:].copy()

    model = build_prophet(country)
    model.fit(train)

    future = pd.DataFrame({"ds": test["ds"]})
    fc = model.predict(future)[["ds", "yhat"]]
    fc = fc.set_index("ds")

    results: dict[int, float] = {}
    last_train_date = train["ds"].iloc[-1]
    for h in EVAL_HORIZONS:
        target_date = last_train_date + pd.Timedelta(days=h)
        if target_date not in fc.index:
            continue
        truth_row = test[test["ds"] == target_date]
        if truth_row.empty:
            continue
        y_true = np.array([float(truth_row["y"].iloc[0])])
        y_pred = np.array([float(fc.loc[target_date, "yhat"])])
        results[h] = safe_mape(y_true, y_pred)
    return results


def evaluate_lightgbm(
    daily_for_account: pd.DataFrame,
    accounts_meta: dict[str, dict],
    daily_all: pd.DataFrame,
    holdout_days: int,
) -> dict[int, float]:
    import lightgbm as lgb

    train_daily = daily_all[
        pd.to_datetime(daily_all["date"]) < pd.to_datetime(daily_all["date"]).max() - pd.Timedelta(days=holdout_days)
    ].copy()
    full_daily = daily_all.copy()

    features = build_daily_features(train_daily, accounts_meta)
    supervised, feature_cols = build_supervised(features, HORIZONS)
    if supervised.empty:
        return {}
    supervised = supervised[supervised["account_id"] == daily_for_account["account_id"].iloc[0]]
    if supervised.empty:
        return {}

    X = supervised[feature_cols].to_numpy(dtype=float)
    y = supervised["target"].to_numpy(dtype=float)
    train_set = lgb.Dataset(X, label=y, free_raw_data=False)
    params = {
        "objective": "quantile",
        "alpha": 0.5,
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
    booster = lgb.train(params, train_set, num_boost_round=400, callbacks=[lgb.log_evaluation(0)])

    full_features = build_daily_features(full_daily, accounts_meta)
    account_id = daily_for_account["account_id"].iloc[0]
    last_train_date = pd.to_datetime(train_daily["date"]).max()

    sub = full_features[
        (full_features["account_id"] == account_id)
        & (pd.to_datetime(full_features["date"]) == last_train_date)
    ]
    if sub.empty:
        return {}
    last_feats = sub.iloc[0]

    results: dict[int, float] = {}
    for h in EVAL_HORIZONS:
        row = {k: last_feats[k] for k in feature_cols if k != "horizon"}
        row["horizon"] = float(h)
        X_eval = np.array([[row[c] for c in feature_cols]], dtype=float)
        y_pred = float(booster.predict(X_eval)[0])

        target_date = last_train_date + pd.Timedelta(days=h)
        truth = full_daily[
            (full_daily["account_id"] == account_id)
            & (pd.to_datetime(full_daily["date"]) == target_date)
        ]
        if truth.empty:
            continue
        y_true = float(truth["balance"].iloc[0])
        results[h] = safe_mape(np.array([y_true]), np.array([y_pred]))
    return results


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--daily", type=str, default=str(ML_ROOT / "data" / "daily_balances.parquet")
    )
    parser.add_argument(
        "--output", type=str, default=str(ML_ROOT / "models" / "selection.json")
    )
    parser.add_argument("--holdout-days", type=int, default=HOLDOUT_DAYS)
    args = parser.parse_args()

    silence_logs()
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
    print(f"Running holdout backtest (last {args.holdout_days} days).")

    for account in accounts:
        sub = daily[daily["account_id"] == account.id].copy()
        if sub.empty:
            continue
        prophet_mape = evaluate_prophet(sub, account.country_for_holidays, args.holdout_days)
        lgb_mape = evaluate_lightgbm(sub, accounts_meta, daily, args.holdout_days)

        prophet_score = prophet_mape.get(SELECTION_HORIZON, float("inf"))
        lgb_score = lgb_mape.get(SELECTION_HORIZON, float("inf"))
        if prophet_score == float("inf") and lgb_score == float("inf"):
            chosen = "prophet"
        elif lgb_score < prophet_score:
            chosen = "lightgbm"
        else:
            chosen = "prophet"

        selections[account.id] = {
            "chosen": chosen,
            "prophet_mape": {str(h): round(v, 2) for h, v in prophet_mape.items()},
            "lightgbm_mape": {str(h): round(v, 2) for h, v in lgb_mape.items()},
        }
        print(
            f"  {account.id:>22s}: prophet h7={prophet_score:>6.2f}%  "
            f"lgb h7={lgb_score:>6.2f}%  -> {chosen}"
        )

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(selections, indent=2))
    print(f"Wrote {out_path}")

    prophet_count = sum(1 for v in selections.values() if v["chosen"] == "prophet")
    lgb_count = sum(1 for v in selections.values() if v["chosen"] == "lightgbm")
    print(f"Selection: prophet={prophet_count}  lightgbm={lgb_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
