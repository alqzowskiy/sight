from __future__ import annotations

from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

CURRENCIES = ("EUR", "USD", "GBP", "SGD", "CHF")
ACCOUNT_TYPES = ("operational", "settlement", "reserve")

CALENDAR_COLUMNS = (
    "day_of_week",
    "day_of_month",
    "month",
    "is_weekend",
    "is_payday",
    "is_month_end",
    "is_holiday",
    "days_until_payday",
)

LAG_DAYS = (1, 3, 7, 14, 30)
ROLLING_WINDOWS = (7, 14, 30)

FEATURE_GROUP_LABELS: dict[str, str] = {
    "balance_lag_1": "yesterday's balance",
    "balance_lag_3": "3-day lag",
    "balance_lag_7": "balance one week ago",
    "balance_lag_14": "two-week lag",
    "balance_lag_30": "one-month lag",
    "rolling_mean_7": "recent 7-day average",
    "rolling_mean_14": "recent 14-day average",
    "rolling_mean_30": "monthly baseline",
    "rolling_std_7": "recent volatility",
    "rolling_std_14": "14-day volatility",
    "rolling_std_30": "30-day volatility",
    "net_flow_7d_sum": "recent net flow",
    "inflow_7d_sum": "recent inflows",
    "outflow_7d_sum": "recent outflows",
    "pending_inflow": "settlements arriving",
    "pending_outflow": "settlements leaving",
    "day_of_week": "weekday effect",
    "day_of_month": "monthly cycle",
    "month": "month-of-year",
    "is_weekend": "weekend",
    "is_payday": "payday cycle",
    "is_month_end": "month-end pressure",
    "is_holiday": "country holiday",
    "days_until_payday": "approaching payday",
    "horizon": "forecast distance",
    "total_company_balance": "company-wide liquidity",
    "same_currency_balance": "same-currency pool",
}


def _country_holiday_set(country_code: str | None, years: list[int]) -> set[date]:
    if not country_code:
        return set()
    try:
        import holidays as _holidays
    except Exception:
        return set()
    try:
        cal = _holidays.country_holidays(country_code, years=years)
    except Exception:
        return set()
    return set(cal.keys())


def _days_until_payday(d: date) -> int:
    from datetime import timedelta as _td

    if d.day < 15:
        return 15 - d.day
    if d.day == 15:
        return 0
    next_month_first = date(
        d.year + (1 if d.month == 12 else 0),
        1 if d.month == 12 else d.month + 1,
        1,
    )
    last_day = next_month_first - _td(days=1)
    days_in_month = last_day.day
    return days_in_month - d.day + 1


def calendar_features(d: date, holiday_set: set[date]) -> dict[str, float]:
    return {
        "day_of_week": float(d.weekday()),
        "day_of_month": float(d.day),
        "month": float(d.month),
        "is_weekend": 1.0 if d.weekday() >= 5 else 0.0,
        "is_payday": 1.0 if d.day in (1, 15) else 0.0,
        "is_month_end": 1.0 if d.day >= 28 else 0.0,
        "is_holiday": 1.0 if d in holiday_set else 0.0,
        "days_until_payday": float(_days_until_payday(d)),
    }


def encode_categorical(currency: str, account_type: str) -> dict[str, float]:
    out: dict[str, float] = {}
    for c in CURRENCIES:
        out[f"currency_{c}"] = 1.0 if currency == c else 0.0
    for t in ACCOUNT_TYPES:
        out[f"type_{t}"] = 1.0 if account_type == t else 0.0
    return out


def build_daily_features(
    daily: pd.DataFrame,
    accounts_meta: dict[str, dict],
) -> pd.DataFrame:
    """For each (account_id, date) row in daily_balances, build a feature row.

    Output keeps `account_id`, `date`, all features. The target column is added
    by the caller (`build_supervised`).
    """
    df = daily.copy()
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["account_id", "date"]).reset_index(drop=True)

    total_by_date = df.groupby("date")["balance"].sum().rename("total_company_balance")
    df = df.merge(total_by_date, left_on="date", right_index=True)

    df["currency"] = df["account_id"].map(lambda x: accounts_meta[x]["currency"])
    df["type"] = df["account_id"].map(lambda x: accounts_meta[x]["type"])
    same_curr = (
        df.groupby(["date", "currency"])["balance"].sum().rename("same_currency_balance")
    )
    df = df.merge(same_curr, left_on=["date", "currency"], right_index=True)

    feature_rows: list[dict] = []
    for account_id, group in df.groupby("account_id"):
        meta = accounts_meta[account_id]
        years = sorted({d.year for d in group["date"].dt.date.tolist()})
        h_set = _country_holiday_set(meta.get("country_for_holidays"), years)

        balances = group["balance"].to_numpy()
        inflows = group["inflow"].to_numpy()
        outflows = group["outflow"].to_numpy()
        net_flow = group["net_flow"].to_numpy()
        pending_in = group["pending_inflow"].to_numpy()
        pending_out = group["pending_outflow"].to_numpy()
        dates = group["date"].dt.date.tolist()

        for i, d in enumerate(dates):
            feat: dict[str, float] = {}
            for lag in LAG_DAYS:
                feat[f"balance_lag_{lag}"] = (
                    float(balances[i - lag]) if i - lag >= 0 else float(balances[0])
                )
            for w in ROLLING_WINDOWS:
                lo = max(0, i - w + 1)
                window = balances[lo : i + 1]
                feat[f"rolling_mean_{w}"] = float(window.mean()) if window.size else 0.0
                feat[f"rolling_std_{w}"] = (
                    float(window.std(ddof=0)) if window.size > 1 else 0.0
                )
            net_lo = max(0, i - 6)
            feat["net_flow_7d_sum"] = float(net_flow[net_lo : i + 1].sum())
            feat["inflow_7d_sum"] = float(inflows[net_lo : i + 1].sum())
            feat["outflow_7d_sum"] = float(outflows[net_lo : i + 1].sum())
            feat["pending_inflow"] = float(pending_in[i])
            feat["pending_outflow"] = float(pending_out[i])
            feat.update(calendar_features(d, h_set))
            feat.update(encode_categorical(meta["currency"], meta["type"]))
            feat["total_company_balance"] = float(group["total_company_balance"].iloc[i])
            feat["same_currency_balance"] = float(group["same_currency_balance"].iloc[i])
            feat["account_id"] = account_id
            feat["date"] = d
            feat["balance"] = float(balances[i])
            feature_rows.append(feat)

    return pd.DataFrame(feature_rows)


def build_supervised(
    features: pd.DataFrame,
    horizons: list[int],
) -> tuple[pd.DataFrame, list[str]]:
    """Pair each feature row with its target balance at +h days.

    Adds `horizon` and `target` columns. Drops rows where target unavailable.
    """
    rows: list[pd.DataFrame] = []
    features = features.copy()
    features["date"] = pd.to_datetime(features["date"])
    feature_cols_excluded = {"account_id", "date", "balance"}
    for h in horizons:
        copy = features.copy()
        copy["horizon"] = float(h)
        copy["target_date"] = copy["date"] + pd.Timedelta(days=h)
        target_map = features.set_index(["account_id", "date"])["balance"].to_dict()
        copy["target"] = copy.apply(
            lambda r: target_map.get((r["account_id"], r["target_date"]), np.nan),
            axis=1,
        )
        rows.append(copy)
    out = pd.concat(rows, ignore_index=True)
    out = out.dropna(subset=["target"])
    feature_cols = [c for c in out.columns if c not in feature_cols_excluded.union({"target", "target_date"})]
    return out, feature_cols
