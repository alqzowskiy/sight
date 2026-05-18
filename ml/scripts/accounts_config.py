from __future__ import annotations
import json
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ML_ROOT = REPO_ROOT / "ml"
PUBLIC_DATA = REPO_ROOT / "public" / "data"
ACCOUNTS_JSON = PUBLIC_DATA / "accounts.json"


@dataclass(frozen=True)
class Account:
    id: str
    name: str
    bank: str
    currency: str
    country: str
    location: tuple[float, float]
    min_balance: float
    type: str

    @property
    def country_for_holidays(self) -> str | None:
        if self.country == "GB":
            return "UK"
        if self.country in {"DE", "FR", "US", "SG", "CH"}:
            return self.country
        return None


@dataclass(frozen=True)
class TrajectorySpec:
    """A piecewise-linear path the account's daily balance follows.

    points: list of (day_index_from_start, target_balance). Linear interpolation
    fills the gaps. day_index_from_start=0 is the oldest day, =history_days-1 is today.
    """

    points: tuple[tuple[float, float], ...]


@dataclass(frozen=True)
class AccountProfile:
    trajectory: TrajectorySpec
    weekly_amplitude: float
    weekly_phase: float
    monthly_amplitude: float
    daily_noise_sigma: float
    holiday_dampen: float
    txn_count_median: int
    log_sigma: float


def _operational_trajectory(start: float, end: float) -> TrajectorySpec:
    mid = (start + end) / 2 + (end - start) * 0.15
    return TrajectorySpec(points=((0.0, start), (0.45, mid), (1.0, end)))


def _flat_trajectory(level: float, drift: float = 0.0) -> TrajectorySpec:
    return TrajectorySpec(points=((0.0, level), (1.0, level + drift)))


def _stress_trajectory(start: float, end: float) -> TrajectorySpec:
    return TrajectorySpec(
        points=(
            (0.0, start),
            (0.35, start * 0.78),
            (0.7, start * 0.55),
            (1.0, end),
        )
    )


PROFILES: dict[str, AccountProfile] = {
    "eur-frankfurt": AccountProfile(
        trajectory=_operational_trajectory(1_050_000, 960_000),
        weekly_amplitude=42_000,
        weekly_phase=0.0,
        monthly_amplitude=55_000,
        daily_noise_sigma=14_000,
        holiday_dampen=0.45,
        txn_count_median=24,
        log_sigma=0.42,
    ),
    "eur-paris": AccountProfile(
        trajectory=_operational_trajectory(820_000, 780_000),
        weekly_amplitude=34_000,
        weekly_phase=0.0,
        monthly_amplitude=42_000,
        daily_noise_sigma=11_000,
        holiday_dampen=0.45,
        txn_count_median=18,
        log_sigma=0.42,
    ),
    "usd-nyc": AccountProfile(
        trajectory=_stress_trajectory(1_180_000, 470_000),
        weekly_amplitude=58_000,
        weekly_phase=0.0,
        monthly_amplitude=75_000,
        daily_noise_sigma=22_000,
        holiday_dampen=0.40,
        txn_count_median=32,
        log_sigma=0.48,
    ),
    "usd-sf": AccountProfile(
        trajectory=_operational_trajectory(720_000, 660_000),
        weekly_amplitude=30_000,
        weekly_phase=0.0,
        monthly_amplitude=36_000,
        daily_noise_sigma=10_000,
        holiday_dampen=0.45,
        txn_count_median=16,
        log_sigma=0.42,
    ),
    "gbp-london": AccountProfile(
        trajectory=_operational_trajectory(520_000, 475_000),
        weekly_amplitude=22_000,
        weekly_phase=0.0,
        monthly_amplitude=28_000,
        daily_noise_sigma=8_000,
        holiday_dampen=0.45,
        txn_count_median=14,
        log_sigma=0.42,
    ),
    "sgd-singapore": AccountProfile(
        trajectory=_operational_trajectory(1_080_000, 1_020_000),
        weekly_amplitude=44_000,
        weekly_phase=0.0,
        monthly_amplitude=50_000,
        daily_noise_sigma=14_000,
        holiday_dampen=0.50,
        txn_count_median=18,
        log_sigma=0.42,
    ),
    "chf-zurich": AccountProfile(
        trajectory=_operational_trajectory(410_000, 385_000),
        weekly_amplitude=18_000,
        weekly_phase=0.0,
        monthly_amplitude=22_000,
        daily_noise_sigma=6_500,
        holiday_dampen=0.45,
        txn_count_median=10,
        log_sigma=0.40,
    ),
    "visa-eur": AccountProfile(
        trajectory=_flat_trajectory(320_000, drift=-10_000),
        weekly_amplitude=70_000,
        weekly_phase=0.2,
        monthly_amplitude=42_000,
        daily_noise_sigma=18_000,
        holiday_dampen=0.65,
        txn_count_median=42,
        log_sigma=0.55,
    ),
    "mc-usd": AccountProfile(
        trajectory=_flat_trajectory(285_000, drift=-15_000),
        weekly_amplitude=62_000,
        weekly_phase=0.2,
        monthly_amplitude=38_000,
        daily_noise_sigma=16_000,
        holiday_dampen=0.65,
        txn_count_median=40,
        log_sigma=0.55,
    ),
    "regulatory-reserve": AccountProfile(
        trajectory=_flat_trajectory(8_050_000, drift=60_000),
        weekly_amplitude=12_000,
        weekly_phase=0.0,
        monthly_amplitude=18_000,
        daily_noise_sigma=6_000,
        holiday_dampen=0.80,
        txn_count_median=2,
        log_sigma=0.35,
    ),
    "fx-hedging": AccountProfile(
        trajectory=_flat_trajectory(2_560_000, drift=40_000),
        weekly_amplitude=35_000,
        weekly_phase=0.0,
        monthly_amplitude=45_000,
        daily_noise_sigma=14_000,
        holiday_dampen=0.70,
        txn_count_median=6,
        log_sigma=0.42,
    ),
}


def load_accounts() -> list[Account]:
    raw = json.loads(ACCOUNTS_JSON.read_text())
    accounts: list[Account] = []
    for entry in raw:
        accounts.append(
            Account(
                id=entry["id"],
                name=entry["name"],
                bank=entry["bank"],
                currency=entry["currency"],
                country=entry["country"],
                location=tuple(entry["location"]),
                min_balance=float(entry["minBalance"]),
                type=entry["type"],
            )
        )
    return accounts


def profile_for(account_id: str) -> AccountProfile:
    return PROFILES[account_id]


def interpolate_trajectory(spec: TrajectorySpec, t: float) -> float:
    if t <= spec.points[0][0]:
        return spec.points[0][1]
    if t >= spec.points[-1][0]:
        return spec.points[-1][1]
    for i in range(len(spec.points) - 1):
        t0, v0 = spec.points[i]
        t1, v1 = spec.points[i + 1]
        if t0 <= t <= t1:
            ratio = (t - t0) / (t1 - t0) if t1 > t0 else 0.0
            return v0 + (v1 - v0) * ratio
    return spec.points[-1][1]
