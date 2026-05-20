from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from features import build_daily_features, FEATURE_GROUP_LABELS


def predict_prophet(model, last_date: pd.Timestamp, days: int) -> pd.DataFrame:
    future = pd.DataFrame(
        {"ds": pd.date_range(start=last_date + pd.Timedelta(days=1), periods=days, freq="D")}
    )
    fc = model.predict(future)
    out = fc[["ds", "yhat", "yhat_lower", "yhat_upper"]].copy()
    out.columns = ["date", "balance", "p10", "p90"]
    return out


def build_inference_features(
    daily_for_account: pd.DataFrame,
    accounts_meta: dict[str, dict],
    feature_cols: list[str],
    horizons: list[int],
    daily_all: pd.DataFrame | None = None,
) -> tuple[np.ndarray, pd.Timestamp]:
    """Compute the feature row at the last historical date, broadcast across horizons."""
    full = daily_all if daily_all is not None else daily_for_account
    feats = build_daily_features(full, accounts_meta)
    account_id = daily_for_account["account_id"].iloc[0]
    sub = feats[feats["account_id"] == account_id].copy()
    sub = sub.sort_values("date").reset_index(drop=True)
    last_row = sub.iloc[-1:].copy()
    last_date = pd.to_datetime(last_row["date"].iloc[0])

    rows: list[dict] = []
    for h in horizons:
        row = last_row.iloc[0].to_dict()
        row["horizon"] = float(h)
        rows.append({k: row[k] for k in feature_cols if k in row})
    X = pd.DataFrame(rows)
    return X[feature_cols].to_numpy(dtype=float), last_date


def predict_lightgbm(
    bundle: dict,
    daily_for_account: pd.DataFrame,
    accounts_meta: dict[str, dict],
    horizons: list[int],
    daily_all: pd.DataFrame | None = None,
) -> pd.DataFrame:
    feature_cols = bundle["feature_cols"]
    X, last_date = build_inference_features(
        daily_for_account, accounts_meta, feature_cols, horizons, daily_all=daily_all
    )

    models = bundle["models"]
    pred_low = models[0.1].predict(X)
    pred_mid = models[0.5].predict(X)
    pred_high = models[0.9].predict(X)

    # Independent quantile regressions can produce crossing (p10 > p50 or p90 < p50).
    # Post-hoc sort guarantees p10 <= p50 <= p90 per horizon point.
    stacked = np.vstack([pred_low, pred_mid, pred_high])
    stacked.sort(axis=0)
    pred_low, pred_mid, pred_high = stacked[0], stacked[1], stacked[2]

    dates = [last_date + pd.Timedelta(days=int(h)) for h in horizons]
    out = pd.DataFrame(
        {
            "date": dates,
            "balance": pred_mid,
            "p10": pred_low,
            "p90": pred_high,
            "horizon": [int(h) for h in horizons],
        }
    )
    return out


def shap_for_lightgbm(
    bundle: dict,
    daily_for_account: pd.DataFrame,
    accounts_meta: dict[str, dict],
    horizons: list[int],
    daily_all: pd.DataFrame | None = None,
    top_k: int = 5,
) -> list[list[dict]]:
    """Compute SHAP top features for each horizon prediction (using median model)."""
    try:
        import shap as _shap
    except Exception:
        return [[] for _ in horizons]

    feature_cols = bundle["feature_cols"]
    X, _ = build_inference_features(
        daily_for_account, accounts_meta, feature_cols, horizons, daily_all=daily_all
    )

    median_model = bundle["models"][0.5]
    try:
        explainer = _shap.TreeExplainer(median_model)
        shap_values = explainer.shap_values(X)
    except Exception:
        return [[] for _ in horizons]

    if isinstance(shap_values, list):
        shap_values = shap_values[0]
    shap_values = np.asarray(shap_values)

    out: list[list[dict]] = []
    for i, h in enumerate(horizons):
        contributions = list(zip(feature_cols, shap_values[i]))
        ranked = sorted(contributions, key=lambda kv: abs(kv[1]), reverse=True)[:top_k]
        out.append(
            [
                {
                    "feature": k,
                    "label": FEATURE_GROUP_LABELS.get(k, k),
                    "impact": float(round(v, 2)),
                }
                for k, v in ranked
            ]
        )
    return out
