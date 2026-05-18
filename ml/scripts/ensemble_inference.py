"""Unified inference across Prophet / LightGBM / ARIMA / ETS / Chronos / Stacker."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from extra_models import predict_arima, predict_chronos, predict_ets, load_chronos_pipeline
from inference import predict_lightgbm, predict_prophet, shap_for_lightgbm


_CHRONOS_PIPELINE = None


def get_chronos():
    global _CHRONOS_PIPELINE
    if _CHRONOS_PIPELINE is None:
        _CHRONOS_PIPELINE = load_chronos_pipeline()
    return _CHRONOS_PIPELINE


def predict_with_model(
    model_name: str,
    account_id: str,
    daily_for_account: pd.DataFrame,
    accounts_meta: dict[str, dict],
    models_dir: Path,
    forecast_days: int,
    daily_all: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Returns DataFrame with date, balance, p10, p90 columns."""
    from joblib import load as joblib_load

    horizons = list(range(1, forecast_days + 1))

    if model_name == "prophet":
        path = models_dir / f"{account_id}_prophet.pkl"
        model = joblib_load(path)
        sub = daily_for_account.copy()
        sub["ds"] = pd.to_datetime(sub["date"])
        last_date = sub["ds"].iloc[-1]
        return predict_prophet(model, last_date, forecast_days)

    if model_name == "lightgbm":
        path = models_dir / f"{account_id}_lightgbm.pkl"
        bundle = joblib_load(path)
        return predict_lightgbm(
            bundle,
            daily_for_account.assign(account_id=account_id),
            accounts_meta,
            horizons,
            daily_all=daily_all,
        )

    if model_name == "arima":
        path = models_dir / f"{account_id}_arima.pkl"
        bundle = joblib_load(path)
        return predict_arima(bundle, forecast_days)

    if model_name == "ets":
        path = models_dir / f"{account_id}_ets.pkl"
        bundle = joblib_load(path)
        return predict_ets(bundle, forecast_days)

    if model_name == "chronos":
        pipeline = get_chronos()
        if pipeline is None:
            raise RuntimeError("Chronos not available")
        return predict_chronos(pipeline, daily_for_account, forecast_days, num_samples=20)

    if model_name == "stacker":
        stack_path = models_dir / f"{account_id}_stacker.pkl"
        stack_bundle = joblib_load(stack_path)
        base_predictions: list[np.ndarray] = []
        base_p10s: list[np.ndarray] = []
        base_p90s: list[np.ndarray] = []
        first_df: pd.DataFrame | None = None
        for base_name in stack_bundle["base_models"]:
            try:
                df = predict_with_model(
                    base_name,
                    account_id,
                    daily_for_account,
                    accounts_meta,
                    models_dir,
                    forecast_days,
                    daily_all=daily_all,
                )
                base_predictions.append(df["balance"].to_numpy())
                base_p10s.append(df["p10"].to_numpy())
                base_p90s.append(df["p90"].to_numpy())
                first_df = df if first_df is None else first_df
            except Exception:
                base_predictions.append(np.full(forecast_days, np.nan))
                base_p10s.append(np.full(forecast_days, np.nan))
                base_p90s.append(np.full(forecast_days, np.nan))

        X = np.column_stack(base_predictions)
        valid_mask = ~np.isnan(X)
        col_means = np.nanmean(X, axis=1, keepdims=True)
        X_filled = np.where(np.isnan(X), col_means, X)
        ridge = stack_bundle["ridge"]
        stacked = ridge.predict(X_filled)

        Z80 = 1.2816
        p10_arr = np.zeros(forecast_days)
        p90_arr = np.zeros(forecast_days)
        for i in range(forecast_days):
            row_preds = X[i]
            row_p10 = np.array([arr[i] for arr in base_p10s])
            row_p90 = np.array([arr[i] for arr in base_p90s])
            preds_valid = row_preds[np.isfinite(row_preds)]
            p10_valid = row_p10[np.isfinite(row_p10)]
            p90_valid = row_p90[np.isfinite(row_p90)]

            disagreement_std = float(np.std(preds_valid, ddof=0)) if preds_valid.size > 1 else 0.0
            if p10_valid.size and p90_valid.size:
                mean_band = float(np.mean(p90_valid - p10_valid)) / 2.0
            else:
                mean_band = 0.0
            half_width = max(Z80 * disagreement_std, mean_band)
            p10_arr[i] = stacked[i] - half_width
            p90_arr[i] = stacked[i] + half_width

        return pd.DataFrame(
            {
                "date": first_df["date"] if first_df is not None else pd.date_range(
                    pd.to_datetime(daily_for_account["date"].iloc[-1]) + pd.Timedelta(days=1),
                    periods=forecast_days,
                    freq="D",
                ),
                "balance": stacked,
                "p10": p10_arr,
                "p90": p90_arr,
            }
        )

    raise ValueError(f"Unknown model: {model_name}")


def shap_for_account(
    model_name: str,
    account_id: str,
    daily_for_account: pd.DataFrame,
    accounts_meta: dict[str, dict],
    models_dir: Path,
    forecast_days: int,
    daily_all: pd.DataFrame | None = None,
) -> list[list[dict]]:
    if model_name == "lightgbm":
        from joblib import load as joblib_load

        bundle = joblib_load(models_dir / f"{account_id}_lightgbm.pkl")
        return shap_for_lightgbm(
            bundle,
            daily_for_account.assign(account_id=account_id),
            accounts_meta,
            list(range(1, forecast_days + 1)),
            daily_all=daily_all,
            top_k=5,
        )
    return [[] for _ in range(forecast_days)]
