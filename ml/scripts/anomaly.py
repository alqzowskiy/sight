"""Detect anomalous transactions per account using IsolationForest.

Why this exists
---------------
Treasury anomaly detection is operational risk management:
  - Compromised credentials draining a corp account (sudden large outflow).
  - Misrouted SWIFT MT103 (transaction in unusual channel/corridor).
  - Duplicate settlement runs (two identical Visa batches on the same day).

We catch these as outliers in the per-account transaction distribution. Each
account gets its own model — visa-eur sees thousands of small EUR txns,
usd-nyc sees a few large USD ones; a global model would dilute the signal.

Features
--------
Per-transaction features:
  - signed_amount   — amount with sign from is_outflow (outflow = negative)
  - amount_log      — log10(|amount| + 1), captures order-of-magnitude
  - hour            — hour of day (timestamps are UTC)
  - dow             — day of week (0 = Mon)
  - channel_id      — categorical encoding of channel
  - settle_lag_h    — hours between submission and settlement (lag anomaly)

The model is IsolationForest with contamination 0.03 (assume ~3% anomalies in
synthetic generator — tweakable). Anomalies are exported with timestamps,
accounts, channel, signed amount, and the model's anomaly score.

Output
------
ml/data/anomalies.parquet (full table, used by backtest and audit)
  columns: account_id, timestamp, channel, amount, signed_amount, score

The export_for_frontend.py step then attaches a slim version of the anomaly
list to public/data/forecasts.json for UI rendering.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from accounts_config import ML_ROOT  # noqa: E402


CONTAMINATION = 0.03  # expected fraction of anomalies per account


def build_features(txns: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return (feature_matrix, original_with_helpers).

    feature_matrix is a numeric frame ready for IsolationForest.
    original_with_helpers carries timestamps and ids for later export.
    """
    df = txns.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df["settles_at"] = pd.to_datetime(df["settles_at"], utc=True)

    df["signed_amount"] = np.where(df["is_outflow"], -df["amount"], df["amount"])
    df["amount_log"] = np.log10(np.abs(df["amount"]).astype(float) + 1.0)
    df["hour"] = df["timestamp"].dt.hour.astype(int)
    df["dow"] = df["timestamp"].dt.dayofweek.astype(int)
    df["settle_lag_h"] = (
        (df["settles_at"] - df["timestamp"]).dt.total_seconds() / 3600.0
    ).fillna(0.0)

    # Channel as categorical → int code, stable order so models are reproducible.
    df["channel_id"] = df["channel"].astype("category").cat.codes.astype(int)

    feats = df[
        [
            "signed_amount",
            "amount_log",
            "hour",
            "dow",
            "channel_id",
            "settle_lag_h",
        ]
    ].astype(float)

    return feats, df


def detect_for_account(
    account_id: str, txns: pd.DataFrame, contamination: float
) -> pd.DataFrame:
    if len(txns) < 50:
        # Too few points for IsolationForest to be meaningful; skip.
        return pd.DataFrame()

    feats, enriched = build_features(txns)
    iso = IsolationForest(
        contamination=contamination,
        n_estimators=200,
        random_state=42,
        n_jobs=-1,
    )
    iso.fit(feats)

    # decision_function: higher = more normal. Negate so higher = more anomalous,
    # then rescale to [0, 1] within this account.
    raw = -iso.decision_function(feats)
    scaled = (raw - raw.min()) / (raw.max() - raw.min() + 1e-9)
    is_anom = iso.predict(feats) == -1

    enriched["score"] = scaled
    enriched["is_anomaly"] = is_anom
    return enriched.loc[enriched["is_anomaly"]].copy()


def main() -> int:
    parser = argparse.ArgumentParser(description="Detect anomalous transactions per account.")
    parser.add_argument(
        "--input",
        type=str,
        default=str(ML_ROOT / "data" / "transactions.parquet"),
        help="Path to transactions parquet",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=str(ML_ROOT / "data" / "anomalies.parquet"),
        help="Output anomalies parquet",
    )
    parser.add_argument(
        "--contamination",
        type=float,
        default=CONTAMINATION,
        help="Expected anomaly fraction per account",
    )
    args = parser.parse_args()

    in_path = Path(args.input)
    out_path = Path(args.output)
    if not in_path.exists():
        print(f"Transactions file not found at {in_path}", file=sys.stderr)
        return 1

    txns = pd.read_parquet(in_path)
    if txns.empty:
        print("No transactions to score, exiting.", file=sys.stderr)
        return 0

    anomalies: list[pd.DataFrame] = []
    for account_id, group in txns.groupby("account_id"):
        flagged = detect_for_account(str(account_id), group, args.contamination)
        if not flagged.empty:
            anomalies.append(flagged)
            print(
                f"  {account_id}: {len(flagged):4d} anomalies "
                f"out of {len(group):5d} txns "
                f"({100.0 * len(flagged) / len(group):.2f}%)"
            )
        else:
            print(f"  {account_id}: skipped (insufficient data)")

    if not anomalies:
        print("No anomalies detected in any account.")
        return 0

    combined = pd.concat(anomalies, ignore_index=True)
    cols = [
        "account_id",
        "timestamp",
        "channel",
        "amount",
        "signed_amount",
        "score",
        "currency",
    ]
    combined = combined[cols].sort_values(["account_id", "timestamp"])
    out_path.parent.mkdir(parents=True, exist_ok=True)
    combined.to_parquet(out_path, index=False)
    print(
        f"Wrote {len(combined)} anomalies across "
        f"{combined['account_id'].nunique()} accounts → {out_path}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
