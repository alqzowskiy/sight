import type { Account, AccountStatus, ForecastPoint } from "@/types";
import { accountMetas } from "@/lib/data/accounts";
import { useCrisisStore } from "@/lib/store/crisis-store";
import { getCrisisScenario } from "@/lib/data/crisis-scenarios";
import {
  getAccountPoints,
  getAccountPointsInRange,
  getForecastPointRaw,
  getToday,
  type ForecastPointIndexed,
} from "@/lib/data/forecasts";

const CURRENCY_BY_ACCOUNT = new Map<string, Account["currency"]>();
for (const a of accountMetas) {
  CURRENCY_BY_ACCOUNT.set(a.id, a.currency);
}

function toForecastPoint(
  accountId: string,
  ip: ForecastPointIndexed,
): ForecastPoint {
  return {
    accountId,
    dayOffset: ip.dayOffset,
    date: ip.date,
    balance: ip.balance,
    p10: ip.p10,
    p90: ip.p90,
    isHistorical: ip.isHistorical,
    pendingInflow: 0,
    pendingOutflow: 0,
  };
}

export function getForecastPoint(
  accountId: string,
  dayOffset: number,
): ForecastPoint | undefined {
  const ip = getForecastPointRaw(accountId, dayOffset);
  if (!ip) return undefined;
  return toForecastPoint(accountId, ip);
}

export function getAccountBalanceAt(
  accountId: string,
  dayOffset: number,
  fallback = 0,
): number {
  const ip = getForecastPointRaw(accountId, dayOffset);
  if (!ip) return fallback;
  return ip.balance;
}

export function getInterpolatedBalance(
  accountId: string,
  exactOffset: number,
  fallback = 0,
): number {
  const lo = Math.floor(exactOffset);
  const hi = Math.ceil(exactOffset);
  if (lo === hi) return getAccountBalanceAt(accountId, lo, fallback);
  const loPoint = getForecastPointRaw(accountId, lo);
  const hiPoint = getForecastPointRaw(accountId, hi);
  if (!loPoint && !hiPoint) return fallback;
  if (!loPoint) return hiPoint!.balance;
  if (!hiPoint) return loPoint.balance;
  const t = exactOffset - lo;
  return loPoint.balance + (hiPoint.balance - loPoint.balance) * t;
}

export function getCrisisDelta(
  accountId: string,
  dayOffset: number,
  baseBalance: number,
): number {
  const active = useCrisisStore.getState().activeScenarios;
  if (active.length === 0) return 0;
  const currency = CURRENCY_BY_ACCOUNT.get(accountId);
  if (!currency) return 0;
  let total = 0;
  for (const id of active) {
    const scenario = getCrisisScenario(id);
    if (!scenario) continue;
    total += scenario.delta({ accountId, currency, dayOffset, baseBalance });
  }
  return total;
}

export function getEffectiveBalanceAt(
  account: Account,
  dayOffset: number,
  liveBalance: number,
): number {
  const forecasted = getAccountBalanceAt(account.id, dayOffset, liveBalance);
  if (dayOffset === 0) {
    return liveBalance + getCrisisDelta(account.id, dayOffset, liveBalance);
  }
  const todayForecast = getAccountBalanceAt(account.id, 0, liveBalance);
  const boost = liveBalance - todayForecast;
  const base = forecasted + boost;
  return base + getCrisisDelta(account.id, dayOffset, forecasted);
}

export function getEffectiveStatusAt(
  account: Account,
  dayOffset: number,
  liveBalance: number,
): AccountStatus {
  if (account.minBalance === 0) return "healthy";
  const balance = getEffectiveBalanceAt(account, dayOffset, liveBalance);
  const ratio = balance / account.minBalance;
  if (ratio < 0.5 || balance < 0) return "critical";
  if (ratio < 1.0) return "warning";
  return "healthy";
}

export function getAccountStatusAt(
  account: Account,
  dayOffset: number,
): AccountStatus {
  return getEffectiveStatusAt(account, dayOffset, account.balance);
}

export function getAccountTrajectory(
  accountId: string,
  fromOffset: number,
  toOffset: number,
): ForecastPoint[] {
  const arr = getAccountPointsInRange(accountId, fromOffset, toOffset);
  return arr.map((p) => toForecastPoint(accountId, p));
}

export function getAccountForecastBand(
  accountId: string,
  dayOffset: number,
): { p10: number; p90: number } | undefined {
  const ip = getForecastPointRaw(accountId, dayOffset);
  if (!ip) return undefined;
  return { p10: ip.p10, p90: ip.p90 };
}

export function getDateForOffset(dayOffset: number): Date {
  const today = getToday();
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return d;
}

export function formatOffsetLabel(offset: number): string {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  if (offset === -1) return "Yesterday";
  if (offset > 0) return `In ${offset} days`;
  return `${Math.abs(offset)} days ago`;
}

export function getAllAccountPoints(accountId: string) {
  return getAccountPoints(accountId);
}
