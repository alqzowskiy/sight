"""Time-weighted split conformal calibration for P10/P90 intervals.

Replaces the prior normality-based scaling. We derive the interval half-width
from absolute residuals on the walk-forward backtest (`actual_vs_predicted_h7`).
Recent residuals are weighted more heavily via exponential decay, which lets
the interval adapt to the most recent regime — a partial answer to the
exchangeability problem that vanilla split conformal has on trending series.

For each account:
    halfwidth = weighted_quantile_q( |actual − predicted| , w )
    P10 = balance − halfwidth
    P90 = balance + halfwidth
where w_i = exp(-(N - 1 - i) / τ), τ = HALF_LIFE_DAYS.

We replace the model-produced intervals entirely with the conformal half-width
to keep the method transparent: one number per account, derived from observed
errors with explicit time weighting.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from accounts_config import PUBLIC_DATA  # noqa: E402

TARGET_COVERAGE = 0.80
HALF_LIFE_DAYS = 14.0


def weighted_quantile(values: np.ndarray, weights: np.ndarray, q: float) -> float:
    """Weighted quantile via linear interpolation of the empirical CDF."""
    if values.size == 0:
        return 0.0
    sorter = np.argsort(values)
    sorted_values = values[sorter]
    sorted_weights = weights[sorter]
    cum = np.cumsum(sorted_weights)
    total = cum[-1]
    if total <= 0:
        return float(np.quantile(values, q))
    cum_norm = cum / total
    return float(np.interp(q, cum_norm, sorted_values))


CALIBRATION_FRACTION = 0.60  # older residuals used to fit half-width
# Remaining (1 - CALIBRATION_FRACTION) are held out to MEASURE coverage.


def conformal_halfwidth_and_coverage(
    backtest_pairs: list[dict],
    target_coverage: float = TARGET_COVERAGE,
    half_life_days: float = HALF_LIFE_DAYS,
    calibration_fraction: float = CALIBRATION_FRACTION,
) -> dict:
    """Time-weighted split conformal with HELD-OUT coverage measurement.

    The residuals are split chronologically: the older
    `calibration_fraction` are used to derive the half-width via a
    time-weighted quantile; the remaining (newer) residuals are held out
    and used to MEASURE empirical coverage post-calibration.

    Returns dict with halfwidth, n_calibration, n_test, empirical_coverage.
    """
    out = {
        "halfwidth": 0.0,
        "n_calibration": 0,
        "n_test": 0,
        "empirical_coverage": None,
    }
    if not backtest_pairs:
        return out

    sorted_pairs = sorted(backtest_pairs, key=lambda p: str(p.get("date", "")))
    residuals = np.array(
        [abs(float(p["actual"]) - float(p["predicted"])) for p in sorted_pairs],
        dtype=float,
    )
    n = residuals.size
    if n < 5:
        # Too few — fall back to all-pairs calibration, no test split.
        ages = np.arange(n - 1, -1, -1, dtype=float)
        weights = np.exp(-ages / half_life_days)
        out["halfwidth"] = float(
            weighted_quantile(residuals, weights, target_coverage)
        )
        out["n_calibration"] = int(n)
        return out

    # Chronological split: older calibration | newer test
    n_cal = max(3, int(np.floor(n * calibration_fraction)))
    n_cal = min(n - 2, n_cal)  # leave at least 2 for test
    cal_residuals = residuals[:n_cal]
    test_residuals = residuals[n_cal:]

    cal_ages = np.arange(n_cal - 1, -1, -1, dtype=float)
    cal_weights = np.exp(-cal_ages / half_life_days)
    halfwidth = float(
        weighted_quantile(cal_residuals, cal_weights, target_coverage)
    )

    # Measure coverage on held-out residuals
    n_test = int(test_residuals.size)
    covered = int(np.sum(test_residuals <= halfwidth))
    emp_cov = covered / n_test if n_test > 0 else None

    out["halfwidth"] = halfwidth
    out["n_calibration"] = int(n_cal)
    out["n_test"] = n_test
    out["empirical_coverage"] = float(emp_cov) if emp_cov is not None else None
    return out


def calibrate_forecasts(
    forecasts: dict,
    backtest: dict,
) -> tuple[dict, dict[str, dict]]:
    avp = backtest.get("actual_vs_predicted_h7", {})
    per_account: dict[str, dict] = {}

    for account_id, points in forecasts["accounts"].items():
        pairs = avp.get(account_id, [])
        info = conformal_halfwidth_and_coverage(pairs)
        per_account[account_id] = info
        hw = info["halfwidth"]
        if hw <= 0:
            continue
        for p in points:
            if p.get("isHistorical"):
                continue
            bal = float(p["balance"])
            p["p10"] = round(bal - hw, 2)
            p["p90"] = round(bal + hw, 2)

    # Aggregate post-calibration coverage across accounts (mean of measured)
    measured = [
        v["empirical_coverage"]
        for v in per_account.values()
        if v["empirical_coverage"] is not None
    ]
    mean_cov = float(np.mean(measured)) if measured else None

    forecasts["calibration"] = {
        "method": "time-weighted split conformal · held-out coverage check",
        "target_coverage": TARGET_COVERAGE,
        "half_life_days": HALF_LIFE_DAYS,
        "calibration_fraction": CALIBRATION_FRACTION,
        "per_account": {
            k: {
                "halfwidth": round(v["halfwidth"], 2),
                "n_calibration": v["n_calibration"],
                "n_test": v["n_test"],
                "empirical_coverage": (
                    round(v["empirical_coverage"], 3)
                    if v["empirical_coverage"] is not None
                    else None
                ),
            }
            for k, v in per_account.items()
        },
        "mean_empirical_coverage_on_test": (
            round(mean_cov, 3) if mean_cov is not None else None
        ),
    }
    return forecasts, per_account


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--forecasts", type=str, default=str(PUBLIC_DATA / "forecasts.json")
    )
    parser.add_argument(
        "--backtest", type=str, default=str(PUBLIC_DATA / "backtest_results.json")
    )
    args = parser.parse_args()

    forecasts = json.loads(Path(args.forecasts).read_text())
    backtest = json.loads(Path(args.backtest).read_text())

    calibrated, per_account = calibrate_forecasts(forecasts, backtest)
    Path(args.forecasts).write_text(json.dumps(calibrated, indent=2))

    print(f"Calibrated intervals written to {args.forecasts}")
    print(
        f"  method=time-weighted split conformal · "
        f"target={TARGET_COVERAGE} · half_life={HALF_LIFE_DAYS}d · "
        f"cal_fraction={CALIBRATION_FRACTION}"
    )
    for account_id, info in sorted(per_account.items()):
        hw = info["halfwidth"]
        n_cal = info["n_calibration"]
        n_test = info["n_test"]
        cov = info["empirical_coverage"]
        cov_str = f"{cov:.2f}" if cov is not None else "—"
        print(
            f"  {account_id:>22s}: hw={hw:>12,.0f}  "
            f"cal={n_cal:>2}  test={n_test:>2}  cov={cov_str}"
        )
    mean_cov = calibrated["calibration"]["mean_empirical_coverage_on_test"]
    if mean_cov is not None:
        print(
            f"  mean empirical coverage on held-out: {mean_cov:.3f} "
            f"(target {TARGET_COVERAGE})"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
