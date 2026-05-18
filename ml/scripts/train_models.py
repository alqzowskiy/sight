from __future__ import annotations

import argparse
import logging
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from accounts_config import ML_ROOT, load_accounts  # noqa: E402
from features import build_daily_features, build_supervised  # noqa: E402

QUANTILES = (0.1, 0.5, 0.9)
HORIZONS = list(range(1, 15))


def silence_logs() -> None:
    warnings.filterwarnings("ignore")
    for name in ("cmdstanpy", "prophet", "prophet.plot", "prophet.models"):
        logging.getLogger(name).setLevel(logging.ERROR)


def build_prophet(country_for_holidays: str | None):
    from prophet import Prophet

    model = Prophet(
        yearly_seasonality=False,
        weekly_seasonality=True,
        daily_seasonality=False,
        interval_width=0.80,
        changepoint_prior_scale=0.05,
        seasonality_prior_scale=8.0,
        seasonality_mode="additive",
    )
    if country_for_holidays:
        try:
            model.add_country_holidays(country_name=country_for_holidays)
        except Exception:
            pass
    return model


def fit_prophet(daily: pd.DataFrame, country_for_holidays: str | None):
    df = daily[["date", "balance"]].copy()
    df["ds"] = pd.to_datetime(df["date"])
    df["y"] = df["balance"].astype(float)
    df = df[["ds", "y"]].sort_values("ds").reset_index(drop=True)
    model = build_prophet(country_for_holidays)
    model.fit(df)
    return model


def train_lightgbm_for_account(
    daily_for_account: pd.DataFrame,
    accounts_meta: dict[str, dict],
):
    import lightgbm as lgb

    features = build_daily_features(daily_for_account, accounts_meta)
    supervised, feature_cols = build_supervised(features, HORIZONS)
    if supervised.empty:
        return None, feature_cols

    X = supervised[feature_cols].to_numpy(dtype=float)
    y = supervised["target"].to_numpy(dtype=float)

    models: dict[float, "lgb.Booster"] = {}
    for q in QUANTILES:
        train_set = lgb.Dataset(X, label=y, free_raw_data=False)
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
        booster = lgb.train(
            params,
            train_set,
            num_boost_round=400,
            callbacks=[lgb.log_evaluation(period=0)],
        )
        models[q] = booster

    return {
        "models": models,
        "feature_cols": feature_cols,
        "n_train": int(len(supervised)),
        "n_features": int(len(feature_cols)),
    }, feature_cols


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input", type=str, default=str(ML_ROOT / "data" / "daily_balances.parquet")
    )
    parser.add_argument("--models-dir", type=str, default=str(ML_ROOT / "models"))
    args = parser.parse_args()

    silence_logs()

    from joblib import dump as joblib_dump

    daily = pd.read_parquet(args.input)
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

    models_dir = Path(args.models_dir)
    models_dir.mkdir(parents=True, exist_ok=True)

    print(f"Training Prophet + LightGBM for {len(accounts)} accounts.")

    for account in accounts:
        sub = daily[daily["account_id"] == account.id].copy()
        if sub.empty:
            print(f"  {account.id}: no data, skipping")
            continue

        prophet_model = fit_prophet(sub, account.country_for_holidays)
        p_path = models_dir / f"{account.id}_prophet.pkl"
        joblib_dump(prophet_model, p_path)

        lgb_bundle, feature_cols = train_lightgbm_for_account(sub, accounts_meta)
        if lgb_bundle is None:
            print(f"  {account.id}: prophet only ({len(sub)} pts, no LGB)")
            continue
        lgb_path = models_dir / f"{account.id}_lightgbm.pkl"
        joblib_dump(lgb_bundle, lgb_path)
        print(
            f"  {account.id}: prophet + lightgbm "
            f"({lgb_bundle['n_train']} train rows, {lgb_bundle['n_features']} feats)"
        )

    print(f"All models saved to {models_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
