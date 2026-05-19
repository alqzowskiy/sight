import forecastsJson from "@/public/data/forecasts.json";
import backtestJson from "@/public/data/backtest_results.json";

export interface ForecastShapItem {
  feature: string;
  label: string;
  impact: number;
}

export interface ForecastPointRaw {
  date: string;
  balance: number;
  p10: number;
  p90: number;
  isHistorical: boolean;
  shap?: ForecastShapItem[];
}

export interface ForecastPointIndexed extends ForecastPointRaw {
  dayOffset: number;
}

interface ForecastsPayload {
  generated_at: string;
  model_version: string;
  ensemble_members?: string[];
  history_days: number;
  forecast_days: number;
  model_per_account: Record<string, string>;
  accounts: Record<string, ForecastPointRaw[]>;
  calibration?: {
    target_coverage?: number;
    scale_per_account?: Record<string, number>;
  };
}

const RAW = forecastsJson as ForecastsPayload;

function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function diffDays(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function buildIndex(): {
  todayByAccount: Map<string, Date>;
  pointsByAccount: Map<string, ForecastPointIndexed[]>;
  pointByKey: Map<string, ForecastPointIndexed>;
  globalToday: Date | null;
} {
  const todayByAccount = new Map<string, Date>();
  const pointsByAccount = new Map<string, ForecastPointIndexed[]>();
  const pointByKey = new Map<string, ForecastPointIndexed>();
  let globalToday: Date | null = null;

  for (const [accountId, points] of Object.entries(RAW.accounts)) {
    const historicals = points.filter((p) => p.isHistorical);
    if (historicals.length === 0) continue;
    const today = parseISODate(historicals[historicals.length - 1].date);
    todayByAccount.set(accountId, today);
    if (globalToday === null || today > globalToday) globalToday = today;

    const indexed: ForecastPointIndexed[] = points.map((p) => ({
      ...p,
      dayOffset: diffDays(parseISODate(p.date), today),
    }));
    indexed.sort((a, b) => a.dayOffset - b.dayOffset);
    pointsByAccount.set(accountId, indexed);
    for (const ip of indexed) {
      pointByKey.set(`${accountId}_${ip.dayOffset}`, ip);
    }
  }

  return { todayByAccount, pointsByAccount, pointByKey, globalToday };
}

const INDEX = buildIndex();

// Runtime layer for user-added accounts. The static INDEX above is built once
// from the JSON the ML pipeline produced. Custom accounts created from the
// Settings panel get their forecasts registered here and merged into the
// lookup paths below.
const runtimePointsByAccount = new Map<string, ForecastPointIndexed[]>();
const runtimePointByKey = new Map<string, ForecastPointIndexed>();

export function setRuntimeForecast(
  accountId: string,
  points: ForecastPointRaw[],
): void {
  if (points.length === 0) {
    removeRuntimeForecast(accountId);
    return;
  }
  const historicals = points.filter((p) => p.isHistorical);
  const anchorDateStr =
    historicals.length > 0
      ? historicals[historicals.length - 1].date
      : points[0].date;
  const anchor = parseISODate(anchorDateStr);
  const indexed: ForecastPointIndexed[] = points
    .map((p) => ({
      ...p,
      dayOffset: diffDays(parseISODate(p.date), anchor),
    }))
    .sort((a, b) => a.dayOffset - b.dayOffset);

  runtimePointsByAccount.set(accountId, indexed);
  // Drop stale entries for this account before re-keying.
  for (const key of Array.from(runtimePointByKey.keys())) {
    if (key.startsWith(`${accountId}_`)) runtimePointByKey.delete(key);
  }
  for (const ip of indexed) {
    runtimePointByKey.set(`${accountId}_${ip.dayOffset}`, ip);
  }
}

export function removeRuntimeForecast(accountId: string): void {
  runtimePointsByAccount.delete(accountId);
  for (const key of Array.from(runtimePointByKey.keys())) {
    if (key.startsWith(`${accountId}_`)) runtimePointByKey.delete(key);
  }
}

export const forecastsMeta = {
  generatedAt: RAW.generated_at,
  modelVersion: RAW.model_version,
  ensembleMembers: RAW.ensemble_members ?? [],
  historyDays: RAW.history_days,
  forecastDays: RAW.forecast_days,
  modelPerAccount: RAW.model_per_account,
  calibration: RAW.calibration,
} as const;

export const backtest = backtestJson as Record<string, unknown>;

export function getToday(): Date {
  return INDEX.globalToday ?? new Date();
}

export function getForecastPointRaw(
  accountId: string,
  dayOffset: number,
): ForecastPointIndexed | undefined {
  return (
    runtimePointByKey.get(`${accountId}_${dayOffset}`) ??
    INDEX.pointByKey.get(`${accountId}_${dayOffset}`)
  );
}

export function getAccountPoints(
  accountId: string,
): ForecastPointIndexed[] {
  return (
    runtimePointsByAccount.get(accountId) ??
    INDEX.pointsByAccount.get(accountId) ??
    []
  );
}

export function getAccountPointsInRange(
  accountId: string,
  fromOffset: number,
  toOffset: number,
): ForecastPointIndexed[] {
  const arr =
    runtimePointsByAccount.get(accountId) ??
    INDEX.pointsByAccount.get(accountId) ??
    [];
  return arr.filter(
    (p) => p.dayOffset >= fromOffset && p.dayOffset <= toOffset,
  );
}

export function getOffsetBounds(accountId: string): {
  min: number;
  max: number;
} {
  const arr =
    runtimePointsByAccount.get(accountId) ??
    INDEX.pointsByAccount.get(accountId) ??
    [];
  if (arr.length === 0) return { min: 0, max: 0 };
  return {
    min: arr[0].dayOffset,
    max: arr[arr.length - 1].dayOffset,
  };
}

export function getModelForAccount(accountId: string): string {
  return forecastsMeta.modelPerAccount[accountId] ?? "prophet";
}
