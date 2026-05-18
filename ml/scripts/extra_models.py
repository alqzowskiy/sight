from __future__ import annotations

import warnings
from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass
class ARIMABundle:
    order: tuple[int, int, int]
    fitted: object
    last_date: pd.Timestamp
    train_mean: float
    train_std: float


@dataclass
class ETSBundle:
    fitted: object
    last_date: pd.Timestamp


def _silence() -> None:
    warnings.filterwarnings("ignore")


def fit_arima(daily: pd.DataFrame) -> ARIMABundle:
    from statsmodels.tsa.arima.model import ARIMA

    _silence()
    df = daily.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    y = df["balance"].astype(float).to_numpy()
    last_date = pd.Timestamp(df["date"].iloc[-1])

    candidate_orders = [
        (1, 1, 1),
        (2, 1, 1),
        (1, 1, 2),
        (2, 1, 2),
        (0, 1, 2),
        (3, 1, 0),
    ]
    best = None
    best_aic = float("inf")
    for order in candidate_orders:
        try:
            model = ARIMA(y, order=order)
            res = model.fit()
            if res.aic < best_aic:
                best_aic = float(res.aic)
                best = (order, res)
        except Exception:
            continue
    if best is None:
        model = ARIMA(y, order=(1, 1, 1))
        res = model.fit()
        best = ((1, 1, 1), res)
    order, fitted = best
    return ARIMABundle(
        order=order,
        fitted=fitted,
        last_date=last_date,
        train_mean=float(np.mean(y)),
        train_std=float(np.std(y)),
    )


def predict_arima(bundle: ARIMABundle, days: int) -> pd.DataFrame:
    fc = bundle.fitted.get_forecast(steps=days)
    mean = np.asarray(fc.predicted_mean).astype(float)
    conf = fc.conf_int(alpha=0.20)
    if hasattr(conf, "values"):
        conf = conf.values
    conf = np.asarray(conf).astype(float)
    lower = conf[:, 0]
    upper = conf[:, 1]
    dates = pd.date_range(start=bundle.last_date + pd.Timedelta(days=1), periods=days, freq="D")
    return pd.DataFrame(
        {
            "date": dates,
            "balance": mean,
            "p10": lower,
            "p90": upper,
        }
    )


def fit_ets(daily: pd.DataFrame) -> ETSBundle:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    _silence()
    df = daily.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    y = df["balance"].astype(float).to_numpy()
    last_date = pd.Timestamp(df["date"].iloc[-1])

    try:
        model = ExponentialSmoothing(
            y,
            trend="add",
            seasonal="add",
            seasonal_periods=7,
            initialization_method="estimated",
        )
        fitted = model.fit(optimized=True)
    except Exception:
        model = ExponentialSmoothing(
            y, trend="add", seasonal=None, initialization_method="estimated"
        )
        fitted = model.fit(optimized=True)
    return ETSBundle(fitted=fitted, last_date=last_date)


def predict_ets(bundle: ETSBundle, days: int) -> pd.DataFrame:
    fc = bundle.fitted.forecast(steps=days)
    mean = np.asarray(fc).astype(float)
    resid = np.asarray(bundle.fitted.resid).astype(float)
    sigma = float(np.std(resid))
    z = 1.2816
    lower = mean - z * sigma
    upper = mean + z * sigma
    dates = pd.date_range(start=bundle.last_date + pd.Timedelta(days=1), periods=days, freq="D")
    return pd.DataFrame(
        {
            "date": dates,
            "balance": mean,
            "p10": lower,
            "p90": upper,
        }
    )


def load_chronos_pipeline():
    """Returns a Chronos pipeline or None if unavailable."""
    try:
        import torch
        from chronos import ChronosPipeline

        device = "cpu"
        pipeline = ChronosPipeline.from_pretrained(
            "amazon/chronos-t5-small",
            device_map=device,
            torch_dtype=torch.float32,
        )
        return pipeline
    except Exception as e:
        print(f"  Chronos unavailable: {e}")
        return None


def predict_chronos(
    pipeline,
    daily: pd.DataFrame,
    days: int,
    num_samples: int = 20,
) -> pd.DataFrame:
    import torch

    df = daily.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    y = df["balance"].astype(float).to_numpy()
    last_date = pd.Timestamp(df["date"].iloc[-1])

    context = torch.tensor(y, dtype=torch.float32)
    samples = pipeline.predict(
        context,
        prediction_length=days,
        num_samples=num_samples,
        limit_prediction_length=False,
    )
    arr = samples[0].cpu().numpy()
    mean = np.median(arr, axis=0)
    lower = np.quantile(arr, 0.1, axis=0)
    upper = np.quantile(arr, 0.9, axis=0)

    dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=days, freq="D")
    return pd.DataFrame(
        {
            "date": dates,
            "balance": mean.astype(float),
            "p10": lower.astype(float),
            "p90": upper.astype(float),
        }
    )
