import type { Currency } from "@/types";

// Approximate spot rates as of demo date (against USD).
// In production these would come from a live FX feed or a partner bank API.
const RATES_TO_USD: Record<Currency, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.27,
  CHF: 1.13,
  SGD: 0.74,
};

// Spread charged on conversion. Typical wholesale FX spread is 20-50 bps.
// We use 40 bps as a middle-ground demo value.
export const FX_SPREAD = 0.004;

export function convertAmount(
  amount: number,
  from: Currency,
  to: Currency,
): number {
  if (from === to) return amount;
  const usd = amount * RATES_TO_USD[from];
  return usd / RATES_TO_USD[to];
}

export function fxFeeUsd(
  amount: number,
  from: Currency,
  to: Currency,
): number {
  if (from === to) return 0;
  const usd = amount * RATES_TO_USD[from];
  return usd * FX_SPREAD;
}

export function isCrossCurrency(from: Currency, to: Currency): boolean {
  return from !== to;
}
