/**
 * Naive baseline forecast generator for tenant-created accounts.
 *
 * Why this exists
 * ---------------
 * The NovaPay demo tenant ships with 180 days of synthesized history and a
 * fully-trained 5-model ensemble (`ml/scripts/`). User-created tenants have
 * none of that — when a CFO adds a fresh account in onboarding configure step,
 * there's nothing for the dashboard to chart, no P10/P90 band, nothing for
 * alerts to fire on.
 *
 * Per HACKATHON_LESSONS we promised "ML warming up for first 30 days" UX. This
 * module is the math behind that: it manufactures a plausible 90-day history
 * + 14-day forecast from a single opening balance + minimum balance.
 *
 * What it does NOT do
 * --------------------
 * - This is NOT predicting the future. It's a placeholder so the UI stays
 *   useful while a real ML pipeline accumulates real data.
 * - It does NOT learn from the user's actual transactions yet. Every account
 *   gets the same noise profile + small weekly seasonality + slow drift back
 *   to the operating point.
 * - It does NOT pretend to be the ensemble. `modelChoice` is hardcoded to
 *   "naive" so the UI shows the right badge and Sight Brain hides itself.
 *
 * Algorithm
 * ---------
 * For each day d in [-historyDays, +forecastDays]:
 *   target_d  = openingBalance × (1 + driftRatePerDay × d)
 *   noise_d   = N(0, σ_daily × openingBalance)  // seeded for determinism
 *   weekly_d  = small sinusoid keyed to weekday-of-week
 *   balance_d = clamp(target_d + weekly_d + noise_d, minBalance × 0.7)
 *   P10/P90   = balance_d ± k × σ_daily × openingBalance × √(d + 1)
 *
 * `driftRatePerDay` is tiny (≤ 0.05% / day) — over 90 days that's ~5% total.
 * `σ_daily` is calibrated against the demo NovaPay generator so the visual
 * texture matches.
 */

const HISTORY_DAYS = 90;
const FORECAST_DAYS = 14;

// Per-day noise as a fraction of opening balance. Matches NovaPay generator.
const DAILY_NOISE_RATIO = 0.012;
const WEEKLY_AMPLITUDE_RATIO = 0.018;
// Conformal band width scales with √horizon to model growing uncertainty.
const INTERVAL_BASE_RATIO = 0.025;
const INTERVAL_HORIZON_RATIO = 0.008;
// Long-run drift back to operating point. Positive for declining accounts.
const DRIFT_RATE = 0.0002;

export interface BaselineForecastInput {
  accountId: string;
  openingBalance: number;
  minBalance: number;
  /** Anchor "today" — usually `new Date()`. Generates [today − history, today + forecast]. */
  anchorDate: Date;
}

export interface BaselineForecastPoint {
  /** UTC ISO date "YYYY-MM-DD". */
  date: string;
  balance: number;
  p10: number;
  p90: number;
  isHistorical: boolean;
}

/**
 * Deterministic seeded RNG so re-running seeds for the same account doesn't
 * produce wildly different baselines. Mulberry32 — small + good enough for
 * synthetic balance noise.
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string into a 32-bit integer for RNG seeding. */
function seedFromAccountId(accountId: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < accountId.length; i++) {
    h ^= accountId.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** Box-Muller transform for normal samples from two uniforms. */
function gaussian(rand: () => number): number {
  const u1 = Math.max(rand(), 1e-9);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function atUtcMidnight(base: Date, offsetDays: number): Date {
  const d = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}

function clamp(value: number, floor: number): number {
  return Math.max(value, floor);
}

/**
 * Generate the baseline forecast trail for a single new account.
 * Returns history (oldest → today) followed by 14 forecast points.
 */
export function generateBaselineForecast(
  input: BaselineForecastInput,
): BaselineForecastPoint[] {
  const { accountId, openingBalance, minBalance, anchorDate } = input;
  const rand = mulberry32(seedFromAccountId(accountId));
  // Hard floor: never let the synthesised history go more than 30% below the
  // user's stated minimum. Otherwise day 1 of the chart looks like a crisis.
  const floor = minBalance > 0 ? minBalance * 0.7 : openingBalance * 0.3;

  const points: BaselineForecastPoint[] = [];
  for (let d = -HISTORY_DAYS; d <= FORECAST_DAYS; d++) {
    const isHistorical = d <= 0;
    const date = atUtcMidnight(anchorDate, d);
    const isoDate = date.toISOString().slice(0, 10);

    let balance: number;
    if (d === 0) {
      // Anchor: today's balance must equal exactly what the user typed in
      // onboarding. Otherwise the dashboard's "current balance" disagrees
      // with the chart on day 0 — very confusing.
      balance = openingBalance;
    } else {
      const drift = openingBalance * DRIFT_RATE * d;
      const noise = openingBalance * DAILY_NOISE_RATIO * gaussian(rand);
      const weekly =
        openingBalance *
        WEEKLY_AMPLITUDE_RATIO *
        Math.sin((date.getUTCDay() / 7) * 2 * Math.PI);
      balance = clamp(openingBalance + drift + noise + weekly, floor);
    }

    // Conformal-style interval: widens with √horizon for forecast points,
    // tight band for history (we "know" the past).
    const horizonForBand = isHistorical ? 0 : d;
    const halfWidth =
      openingBalance *
      (INTERVAL_BASE_RATIO + INTERVAL_HORIZON_RATIO * Math.sqrt(horizonForBand));
    const p10 = clamp(balance - halfWidth, 0);
    const p90 = balance + halfWidth;

    points.push({
      date: isoDate,
      balance: Math.round(balance * 100) / 100,
      p10: Math.round(p10 * 100) / 100,
      p90: Math.round(p90 * 100) / 100,
      isHistorical,
    });
  }
  return points;
}
