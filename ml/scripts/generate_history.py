from __future__ import annotations

import argparse
import math
import sys
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from accounts_config import (  # noqa: E402
    Account,
    AccountProfile,
    ML_ROOT,
    interpolate_trajectory,
    load_accounts,
    profile_for,
)

try:
    import holidays as _holidays
except Exception:  # pragma: no cover
    _holidays = None


CHANNELS_BY_CURRENCY: dict[str, list[tuple[str, float]]] = {
    "EUR": [
        ("SEPA_INSTANT", 0.35),
        ("SEPA_STANDARD", 0.40),
        ("SWIFT", 0.10),
        ("VISA", 0.07),
        ("MASTERCARD", 0.05),
        ("INTERNAL", 0.03),
    ],
    "USD": [
        ("ACH", 0.30),
        ("SWIFT", 0.25),
        ("VISA", 0.18),
        ("MASTERCARD", 0.14),
        ("INTERNAL", 0.13),
    ],
    "GBP": [
        ("SEPA_STANDARD", 0.20),
        ("SWIFT", 0.30),
        ("VISA", 0.20),
        ("MASTERCARD", 0.15),
        ("INTERNAL", 0.15),
    ],
    "SGD": [
        ("SWIFT", 0.45),
        ("VISA", 0.20),
        ("MASTERCARD", 0.18),
        ("INTERNAL", 0.17),
    ],
    "CHF": [
        ("SWIFT", 0.55),
        ("SEPA_STANDARD", 0.15),
        ("VISA", 0.12),
        ("MASTERCARD", 0.10),
        ("INTERNAL", 0.08),
    ],
}


def clearing_delay_days(channel: str, rng: np.random.Generator) -> float:
    if channel in ("SEPA_INSTANT", "INTERNAL"):
        return 0.0
    if channel == "SEPA_STANDARD":
        return 1.0
    if channel == "ACH":
        return float(rng.choice([1, 2], p=[0.6, 0.4]))
    if channel == "VISA":
        return 2.0
    if channel == "MASTERCARD":
        return float(np.clip(rng.gamma(shape=2.5, scale=0.7), 1.0, 4.0))
    if channel == "SWIFT":
        return float(np.clip(rng.gamma(shape=4.0, scale=0.6), 2.0, 5.0))
    return 1.0


def pick_channel(currency: str, rng: np.random.Generator) -> str:
    pairs = CHANNELS_BY_CURRENCY.get(currency, CHANNELS_BY_CURRENCY["USD"])
    names = [p[0] for p in pairs]
    weights = np.array([p[1] for p in pairs])
    weights = weights / weights.sum()
    return str(rng.choice(names, p=weights))


def holiday_set_for(country_code: str | None, years: list[int]) -> set[date] | None:
    if not country_code or _holidays is None:
        return None
    try:
        cal = _holidays.country_holidays(country_code, years=years)
    except Exception:
        return None
    return set(cal.keys())


def build_balance_series(
    profile: AccountProfile,
    history_days: int,
    today: date,
    holiday_set: set[date] | None,
    rng: np.random.Generator,
) -> np.ndarray:
    n = history_days
    days = [today - timedelta(days=n - 1 - i) for i in range(n)]
    balances = np.zeros(n, dtype=float)
    for i, day in enumerate(days):
        t = i / max(1, n - 1)
        trend = interpolate_trajectory(profile.trajectory, t)
        weekday = day.weekday()
        weekly = profile.weekly_amplitude * math.sin(
            2 * math.pi * (weekday / 7.0 + profile.weekly_phase)
        )
        weekly -= profile.weekly_amplitude * 0.4 * (1.0 if weekday >= 5 else 0.0)
        month_phase = (day.day - 1) / 30.0
        monthly = profile.monthly_amplitude * math.sin(2 * math.pi * month_phase - math.pi / 2)
        if day.day in (1, 15):
            monthly += profile.monthly_amplitude * 0.6
        noise = rng.normal(loc=0.0, scale=profile.daily_noise_sigma)
        balance = trend + weekly + monthly + noise
        if holiday_set and day in holiday_set:
            balance -= profile.weekly_amplitude * 0.6
        balances[i] = balance
    return balances


def synthesize_day_transactions(
    account_id: str,
    currency: str,
    day: date,
    net_flow: float,
    txn_count_median: int,
    log_sigma: float,
    profile: AccountProfile,
    rng: np.random.Generator,
    holiday_set: set[date] | None,
) -> list[dict]:
    mult = 1.0
    if day.weekday() >= 5:
        mult *= 0.55
    if holiday_set and day in holiday_set:
        mult *= profile.holiday_dampen
    if day.day in (1, 15):
        mult *= 1.6

    count = max(2, int(rng.poisson(lam=max(2.0, txn_count_median * mult))))
    if count % 2 == 1:
        count += 1
    half = count // 2

    median_amount = max(2_000.0, abs(net_flow) / max(1, count) + 8_000.0)
    inflows = rng.lognormal(mean=math.log(median_amount), sigma=log_sigma, size=half)
    outflows = rng.lognormal(mean=math.log(median_amount), sigma=log_sigma, size=half)

    inflow_total = inflows.sum()
    outflow_total = outflows.sum()
    delta = (inflow_total - outflow_total) - net_flow
    if half > 0:
        outflow_correction = delta / 2.0
        inflow_correction = -delta / 2.0
        outflows = outflows + outflow_correction / half
        inflows = inflows + inflow_correction / half
        inflows = np.maximum(inflows, 100.0)
        outflows = np.maximum(outflows, 100.0)
        # Final re-balance: scale to match net_flow exactly
        adj_in = inflows.sum()
        adj_out = outflows.sum()
        adj_delta = (adj_in - adj_out) - net_flow
        outflows[-1] += adj_delta
        if outflows[-1] < 100.0:
            inflows[-1] -= 100.0 - outflows[-1]
            outflows[-1] = 100.0

    rows: list[dict] = []
    for amt in inflows:
        ts = datetime.combine(day, time(0)) + timedelta(
            seconds=int(rng.integers(8 * 3600, 22 * 3600))
        )
        ts = ts.replace(tzinfo=timezone.utc)
        channel = pick_channel(currency, rng)
        delay = clearing_delay_days(channel, rng)
        rows.append(
            {
                "account_id": account_id,
                "currency": currency,
                "timestamp": ts,
                "settles_at": ts + timedelta(days=delay),
                "amount": float(round(amt, 2)),
                "channel": channel,
                "is_outflow": False,
            }
        )
    for amt in outflows:
        ts = datetime.combine(day, time(0)) + timedelta(
            seconds=int(rng.integers(8 * 3600, 22 * 3600))
        )
        ts = ts.replace(tzinfo=timezone.utc)
        channel = pick_channel(currency, rng)
        delay = clearing_delay_days(channel, rng)
        rows.append(
            {
                "account_id": account_id,
                "currency": currency,
                "timestamp": ts,
                "settles_at": ts + timedelta(days=delay),
                "amount": float(round(-amt, 2)),
                "channel": channel,
                "is_outflow": True,
            }
        )
    return rows


def generate_account(
    account: Account,
    profile: AccountProfile,
    history_days: int,
    today: date,
    rng: np.random.Generator,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    years = sorted({(today - timedelta(days=d)).year for d in range(history_days + 30)})
    h_set = holiday_set_for(account.country_for_holidays, years)

    balances = build_balance_series(profile, history_days, today, h_set, rng)
    days = [today - timedelta(days=history_days - 1 - i) for i in range(history_days)]

    inflow_per_day = np.zeros(history_days)
    outflow_per_day = np.zeros(history_days)
    pending_inflow = np.zeros(history_days)
    pending_outflow = np.zeros(history_days)

    txn_rows: list[dict] = []
    for i, day in enumerate(days):
        if i == 0:
            net_flow = 0.0
        else:
            net_flow = float(balances[i] - balances[i - 1])
        rows = synthesize_day_transactions(
            account.id,
            account.currency,
            day,
            net_flow,
            profile.txn_count_median,
            profile.log_sigma,
            profile,
            rng,
            h_set,
        )
        txn_rows.extend(rows)
        inflow_today = sum(r["amount"] for r in rows if not r["is_outflow"])
        outflow_today = sum(-r["amount"] for r in rows if r["is_outflow"])
        inflow_per_day[i] = inflow_today
        outflow_per_day[i] = outflow_today

    txn_df = pd.DataFrame(txn_rows)
    if not txn_df.empty:
        txn_df["settles_at"] = pd.to_datetime(txn_df["settles_at"])
        txn_df["timestamp"] = pd.to_datetime(txn_df["timestamp"])
        for _, row in txn_df.iterrows():
            settle_d = row["settles_at"].date()
            init_d = row["timestamp"].date()
            if settle_d > init_d:
                try:
                    start = days.index(init_d)
                    end = days.index(settle_d) if settle_d in days else history_days
                except ValueError:
                    continue
                for k in range(start, min(end, history_days)):
                    if row["is_outflow"]:
                        pending_outflow[k] += -float(row["amount"])
                    else:
                        pending_inflow[k] += float(row["amount"])

    daily_df = pd.DataFrame(
        {
            "account_id": account.id,
            "date": [d.isoformat() for d in days],
            "balance": balances,
            "inflow": inflow_per_day,
            "outflow": outflow_per_day,
            "net_flow": inflow_per_day - outflow_per_day,
            "pending_inflow": pending_inflow,
            "pending_outflow": pending_outflow,
        }
    )
    return txn_df, daily_df


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=180)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--today",
        type=str,
        default=None,
        help="ISO date for 'today' (defaults to current UTC date)",
    )
    args = parser.parse_args()

    today = (
        datetime.fromisoformat(args.today).date()
        if args.today
        else datetime.now(timezone.utc).date()
    )
    rng = np.random.default_rng(args.seed)

    accounts = load_accounts()
    print(f"Generating {args.days} days of history for {len(accounts)} accounts (today={today}).")

    tx_frames: list[pd.DataFrame] = []
    daily_frames: list[pd.DataFrame] = []

    for account in accounts:
        profile = profile_for(account.id)
        txn_df, daily_df = generate_account(account, profile, args.days, today, rng)
        tx_frames.append(txn_df)
        daily_frames.append(daily_df)
        latest_balance = float(daily_df["balance"].iloc[-1])
        print(
            f"  {account.id:>22s}: {len(txn_df):>4d} txns  latest={latest_balance:>14,.2f}"
            f"  (min={daily_df['balance'].min():>12,.2f}, max={daily_df['balance'].max():>12,.2f})"
        )

    transactions = pd.concat(tx_frames, ignore_index=True)
    transactions = transactions.sort_values(["timestamp"]).reset_index(drop=True)
    daily = pd.concat(daily_frames, ignore_index=True)

    data_dir = ML_ROOT / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    tx_path = data_dir / "transactions.parquet"
    transactions.to_parquet(tx_path, index=False)
    print(f"Wrote {tx_path} ({len(transactions)} rows)")

    daily_path = data_dir / "daily_balances.parquet"
    daily.to_parquet(daily_path, index=False)
    print(f"Wrote {daily_path} ({len(daily)} rows)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
