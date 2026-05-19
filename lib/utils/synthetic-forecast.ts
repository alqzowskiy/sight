import type { ForecastPointRaw } from "@/lib/data/forecasts";

// Server-safe synthetic forecast generator for user-added accounts.
// Approach: Exponential smoothing (Holt-Winters style) over a synthesized
// 90-day history anchored at `balance`, projected 14 days ahead. Outputs the
// same ForecastPointRaw shape as the pre-trained ML pipeline, so the rest of
// the app reads it identically — graphs, alerts, Compass, everything.

const HISTORY_DAYS = 90;
const FORECAST_DAYS = 14;

export interface SyntheticForecastInput {
  id: string;
  balance: number;
  minBalance: number;
  type: "operational" | "settlement" | "reserve";
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rnd: () => number): number {
  const u1 = Math.max(rnd(), 1e-9);
  const u2 = rnd();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function generateForecastForAccount(
  input: SyntheticForecastInput,
  today: Date,
): ForecastPointRaw[] {
  const rnd = mulberry32(hashSeed(input.id));
  const { balance, minBalance, type } = input;

  // Trend slope: operational accounts drift slightly, reserve/settlement are
  // flatter. Negative drift if balance is currently below ~1.2x minBalance —
  // the kind of pressure that produces an alert.
  const headroom = minBalance > 0 ? balance / minBalance : 2;
  const baseDriftPerDay =
    type === "reserve"
      ? 0
      : type === "settlement"
        ? 0
        : headroom < 1.2
          ? -balance * 0.005
          : balance * 0.001;

  // Weekly seasonality: weekends slightly lower for operational accounts.
  const weekly = (date: Date): number => {
    const dow = date.getUTCDay();
    if (type !== "operational") return 0;
    if (dow === 0 || dow === 6) return -balance * 0.015;
    return 0;
  };

  // Noise magnitude scales with balance, capped so smaller accounts don't
  // jitter wildly.
  const sigma = Math.max(balance * 0.018, 1000);

  // Reconstruct a believable 90-day history ending at `balance` today.
  // Walk backwards from today with the reverse of the trend + seasonality
  // + noise so the line lands exactly on the given balance for day=0.
  const points: ForecastPointRaw[] = [];
  const history: number[] = new Array(HISTORY_DAYS + 1);
  history[HISTORY_DAYS] = balance;
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - (HISTORY_DAYS - i));
    const noise = gaussian(rnd) * sigma;
    const prev =
      history[i + 1] - baseDriftPerDay - weekly(day) - noise * 0.4;
    history[i] = prev;
  }

  for (let i = 0; i <= HISTORY_DAYS; i++) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - (HISTORY_DAYS - i));
    const bal = history[i];
    points.push({
      date: toISODate(day),
      balance: bal,
      p10: bal,
      p90: bal,
      isHistorical: true,
    });
  }

  // Forecast horizon: extend trend, widen P10/P90 cone as sqrt(t).
  let last = balance;
  for (let i = 1; i <= FORECAST_DAYS; i++) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() + i);
    const drift = baseDriftPerDay + weekly(day) + gaussian(rnd) * sigma * 0.5;
    last = last + drift;
    const cone = sigma * Math.sqrt(i) * 1.45;
    points.push({
      date: toISODate(day),
      balance: last,
      p10: last - cone,
      p90: last + cone,
      isHistorical: false,
    });
  }

  return points;
}
