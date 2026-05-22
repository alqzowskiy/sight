import type { Account, Currency } from "@/types";
import { convertAmount } from "@/lib/optimizer/fx";

/**
 * Concentration risk via Herfindahl-Hirschman Index (HHI).
 *
 * HHI is the sum of squared market shares expressed in percentage points.
 * Range: 0 (perfectly diversified) to 10000 (single counterparty).
 *
 * Thresholds follow the US DOJ / Federal Reserve standard, which is the same
 * one used by banking supervisors to gauge counterparty concentration:
 *   <  1500  → low (well diversified)
 *   1500-2500 → moderate
 *   >  2500  → high (single point of failure)
 *
 * Why this matters: SVB-2023 and Credit Suisse-2023 both demonstrated that a
 * single failed counterparty can wipe out treasury liquidity overnight.
 * Tracking HHI by bank, currency, and country tells the treasurer how many
 * eggs are in one basket.
 */

export type ConcentrationDimension = "bank" | "currency" | "country";
export type ConcentrationLevel = "low" | "moderate" | "high";

export interface ConcentrationBucket {
  /** The grouping key — e.g., "JPMorgan", "USD", "US". */
  key: string;
  /** USD-equivalent total balance in this bucket. */
  balance: number;
  /** Share of total portfolio in [0..1]. */
  share: number;
  /** Number of accounts contributing to this bucket. */
  accounts: number;
}

export interface ConcentrationResult {
  dimension: ConcentrationDimension;
  /** HHI in DOJ units (sum of squared percentage shares), 0..10000. */
  hhi: number;
  level: ConcentrationLevel;
  /** Buckets sorted by share desc. */
  breakdown: ConcentrationBucket[];
  /** Sum of USD-equivalent balances across all positive-balance accounts. */
  totalUsd: number;
}

/** Account with country metadata, since the runtime Account type drops it. */
export interface AccountWithCountry extends Account {
  country: string;
}

function classifyLevel(hhi: number): ConcentrationLevel {
  if (hhi < 1500) return "low";
  if (hhi < 2500) return "moderate";
  return "high";
}

function keyFor(
  account: AccountWithCountry,
  dimension: ConcentrationDimension,
): string {
  if (dimension === "bank") return account.bank;
  if (dimension === "currency") return account.currency;
  return account.country;
}

/**
 * Compute HHI for the given accounts across a chosen dimension.
 *
 * Balances are normalized to USD via the live FX table so EUR 5M and USD 5M
 * compare apples-to-apples. Accounts with non-positive balance are excluded
 * (they don't represent capital at risk of counterparty failure).
 */
export function computeHHI(
  accounts: AccountWithCountry[],
  dimension: ConcentrationDimension,
): ConcentrationResult {
  const positive = accounts.filter((a) => a.balance > 0);
  const usdByAccount = positive.map((a) => ({
    account: a,
    usd: convertAmount(a.balance, a.currency as Currency, "USD"),
  }));

  const totalUsd = usdByAccount.reduce((sum, x) => sum + x.usd, 0);

  if (totalUsd === 0) {
    return {
      dimension,
      hhi: 0,
      level: "low",
      breakdown: [],
      totalUsd: 0,
    };
  }

  const grouped = new Map<string, { balance: number; accounts: number }>();
  for (const { account, usd } of usdByAccount) {
    const k = keyFor(account, dimension);
    const prev = grouped.get(k);
    if (prev) {
      prev.balance += usd;
      prev.accounts += 1;
    } else {
      grouped.set(k, { balance: usd, accounts: 1 });
    }
  }

  const breakdown: ConcentrationBucket[] = [...grouped.entries()]
    .map(([key, g]) => ({
      key,
      balance: g.balance,
      share: g.balance / totalUsd,
      accounts: g.accounts,
    }))
    .sort((a, b) => b.share - a.share);

  // HHI = Σ (share_pct)² where share_pct = share × 100, range 0..10000.
  const hhi = breakdown.reduce((sum, b) => sum + (b.share * 100) ** 2, 0);

  return {
    dimension,
    hhi: Math.round(hhi),
    level: classifyLevel(hhi),
    breakdown,
    totalUsd,
  };
}

/** Human-readable label for the DOJ thresholds. */
export function levelLabel(level: ConcentrationLevel): string {
  if (level === "low") return "Diversified";
  if (level === "moderate") return "Moderate";
  return "Concentrated";
}

/** Tailwind text-color class matching the level. */
export function levelColor(level: ConcentrationLevel): string {
  if (level === "low") return "text-emerald-600";
  if (level === "moderate") return "text-amber-600";
  return "text-red-600";
}

/** Tailwind background tint matching the level. */
export function levelBg(level: ConcentrationLevel): string {
  if (level === "low") return "bg-emerald-50";
  if (level === "moderate") return "bg-amber-50";
  return "bg-red-50";
}
