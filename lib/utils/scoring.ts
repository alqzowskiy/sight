import type { Account } from "@/types";
import {
  getEffectiveBalanceAt,
  getEffectiveStatusAt,
  getForecastPoint,
} from "./forecast";

function rawForecastBalance(account: Account, dayOffset: number): number {
  const forecastAt = getForecastPoint(account.id, dayOffset);
  const forecastNow = getForecastPoint(account.id, 0);
  if (!forecastAt) return account.balance;
  if (!forecastNow) return forecastAt.balance;
  const boost = Math.max(0, account.balance - forecastNow.balance);
  return forecastAt.balance + boost;
}

function scoreOne(balance: number, account: Account, status: string): number {
  if (account.minBalance === 0) return 100;
  const ratio = balance / account.minBalance;
  let s = 0;
  if (ratio >= 1.5) s = 100;
  else if (ratio >= 1) s = 70 + (ratio - 1) * 60;
  else s = Math.max(0, ratio * 60);
  if (status === "critical") s -= 25;
  else if (status === "warning") s -= 10;
  if (balance < 0) s -= 20;
  return Math.max(0, Math.min(100, s));
}

export function liquidityScore(
  accounts: Account[],
  offset: number,
  options: { applyCrisis: boolean } = { applyCrisis: true },
): number {
  if (accounts.length === 0) return 0;
  let total = 0;
  for (const a of accounts) {
    if (options.applyCrisis) {
      const balance =
        offset === 0 ? a.balance : getEffectiveBalanceAt(a, offset, a.balance);
      const status =
        offset === 0 ? a.status : getEffectiveStatusAt(a, offset, a.balance);
      total += scoreOne(balance, a, status);
      continue;
    }
    if (offset === 0) {
      total += scoreOne(a.balance, a, a.status);
      continue;
    }
    const raw = rawForecastBalance(a, offset);
    let status: "healthy" | "warning" | "critical" = "healthy";
    if (a.minBalance > 0) {
      const ratio = raw / a.minBalance;
      if (ratio < 0.5 || raw < 0) status = "critical";
      else if (ratio < 1.0) status = "warning";
    }
    total += scoreOne(raw, a, status);
  }
  return Math.round(total / accounts.length);
}

export function crisisImpact(accounts: Account[], offset: number): number {
  const baseline = liquidityScore(accounts, offset, { applyCrisis: false });
  const current = liquidityScore(accounts, offset, { applyCrisis: true });
  return baseline - current;
}
