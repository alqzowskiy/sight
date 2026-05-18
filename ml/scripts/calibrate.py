from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from accounts_config import PUBLIC_DATA  # noqa: E402

TARGET_COVERAGE = 0.80


def _norm_ppf(p: float) -> float:
    """Inverse normal CDF via scipy."""
    from scipy.stats import norm

    return float(norm.ppf(p))


def calibration_scale(empirical_coverage: float) -> float:
    if empirical_coverage <= 0.01:
        return 1.0
    if empirical_coverage >= 0.999:
        return 1.0
    z_emp = _norm_ppf((1.0 + empirical_coverage) / 2.0)
    if z_emp <= 0.01:
        return 1.0
    z_target = _norm_ppf((1.0 + TARGET_COVERAGE) / 2.0)
    return max(1.0, z_target / z_emp)


def calibrate_forecasts(
    forecasts: dict,
    coverage_by_account: dict[str, float],
) -> tuple[dict, dict[str, float]]:
    scaled_widths: dict[str, float] = {}
    for account_id, points in forecasts["accounts"].items():
        coverage = coverage_by_account.get(account_id, TARGET_COVERAGE)
        scale = calibration_scale(coverage)
        scaled_widths[account_id] = round(scale, 3)
        for p in points:
            if p.get("isHistorical"):
                continue
            bal = float(p["balance"])
            p10 = float(p["p10"])
            p90 = float(p["p90"])
            new_p10 = round(bal - (bal - p10) * scale, 2)
            new_p90 = round(bal + (p90 - bal) * scale, 2)
            p["p10"] = new_p10
            p["p90"] = new_p90
    forecasts["calibration"] = {
        "target_coverage": TARGET_COVERAGE,
        "scale_per_account": scaled_widths,
    }
    return forecasts, scaled_widths


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

    coverage_by_account = {
        r["account_id"]: float(r["coverage_p10_p90"]) for r in backtest["per_account"]
    }
    calibrated, scales = calibrate_forecasts(forecasts, coverage_by_account)

    Path(args.forecasts).write_text(json.dumps(calibrated, indent=2))
    print(f"Calibrated intervals written to {args.forecasts}")
    for account_id, scale in sorted(scales.items()):
        cov = coverage_by_account.get(account_id, TARGET_COVERAGE)
        print(
            f"  {account_id:>22s}: empirical_cov={cov:.3f}  scale={scale:.2f}x"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
