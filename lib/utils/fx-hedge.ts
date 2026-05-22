import type { Account, Currency } from "@/types";
import { convertAmount } from "@/lib/optimizer/fx";

/**
 * FX hedge optimizer.
 *
 * Why this matters
 * ----------------
 * Tied to the HACKATHON_LESSONS "6 treasury risks" framing: FX risk is one of
 * the six. Sight closes 4 of 6 — liquidity, regulatory reserve, concentration,
 * and now FX. This is what makes "we are real treasury software" defensible vs
 * "we are predictive cashflow".
 *
 * Reference industry: Kantox and Currencycloud built ~$50M ARR products on
 * automated FX hedging. We're not trying to replace them — but a baseline
 * hedge ratio recommendation is well within scope for a treasury cockpit, and
 * the math is fully self-contained (no external 18+ services needed).
 *
 * Math
 * ----
 * Each non-base-currency operational position carries downside risk if the
 * pair moves against you. The textbook minimum-variance hedge ratio is:
 *
 *   h* = ρ × (σ_exposure / σ_hedge)
 *
 * For a one-currency exposure hedged with its own forward, ρ = 1 and
 * σ_exposure = σ_hedge, so h* = 1 (full hedge). In practice treasury teams
 * pick a lower ratio because:
 *   - Some natural offsetting cash flows exist (revenues in the same currency)
 *   - Hedge cost (forward points + bid/ask) makes 100% hedging expensive
 *   - Tail-risk vs steady-state tradeoff (you hedge tails, not means)
 *
 * Sight's recommendation: hedge enough to bring 1-month 95% VaR within a
 * configurable threshold of the position's USD value. Heavier-vol currencies
 * get a higher hedge ratio than steady ones.
 */

// Annualized FX volatility (vs USD) — indicative values for the demo tenants.
// In production these come from a market data vendor (Refinitiv, Bloomberg).
const ANNUAL_VOL: Record<Currency, number> = {
  USD: 0.0,
  EUR: 0.08, // ~8% annualized
  GBP: 0.1,
  CHF: 0.07,
  SGD: 0.05,
  KZT: 0.12, // emerging-market vol, NDF-hedged
  AED: 0.005, // pegged to USD
  JPY: 0.09,
};

// Indicative all-in cost of hedging via forwards / NDFs, expressed as
// fraction of notional per year. Includes forward points + bid/ask spread.
const HEDGE_COST_ANNUAL: Record<Currency, number> = {
  USD: 0.0,
  EUR: 0.0015, // 15 bps p.a.
  GBP: 0.002,
  CHF: 0.0025,
  SGD: 0.003,
  KZT: 0.012, // NDF, much wider spread
  AED: 0.001, // pegged → cheap
  JPY: 0.002,
};

/** Sight's risk appetite per dollar of exposure for unhedged FX moves.
 *  0.03 means: tolerate 3% of position value as 1-month 95% VaR. */
const TARGET_1M_VAR_FRACTION = 0.03;

export type HedgeAction = "no-action" | "hedge" | "monitor";

export interface FxHedgeRecommendation {
  accountId: string;
  accountName: string;
  bank: string;
  currency: Currency;
  /** Account balance in its native currency. */
  positionNative: number;
  /** Same position converted to USD at current spot. */
  positionUsd: number;
  /** Annualized volatility used in the calculation. */
  annualVol: number;
  /** 1-month VaR at 95% confidence, in USD, assuming no hedge. */
  unhedgedVar1mUsd: number;
  /** Recommended hedge ratio in [0..1]. */
  hedgeRatio: number;
  /** Notional USD to hedge (positionUsd × hedgeRatio). */
  hedgeNotionalUsd: number;
  /** Estimated annual hedging cost in USD. */
  annualCostUsd: number;
  /** 1-month VaR at 95% AFTER applying the recommended hedge. */
  residualVar1mUsd: number;
  /** What Sight is telling the user to do. */
  action: HedgeAction;
  /** Plain-English rationale. */
  reason: string;
}

export interface FxHedgeSummary {
  totalExposureUsd: number;
  totalUnhedgedVar1mUsd: number;
  totalResidualVar1mUsd: number;
  totalHedgeNotionalUsd: number;
  totalAnnualCostUsd: number;
  /** Number of accounts that need an active hedge. */
  hedgesRecommended: number;
}

export interface FxHedgePlan {
  summary: FxHedgeSummary;
  recommendations: FxHedgeRecommendation[];
}

const Z_95 = 1.645; // one-tailed 95% z-score
const SQRT_MONTHLY_SCALING = Math.sqrt(1 / 12); // annualized → 1-month

function var1mUsd(positionUsd: number, annualVol: number): number {
  // 1-month VaR at 95% under lognormal returns: position × σ × √(1/12) × z
  return Math.abs(positionUsd) * annualVol * SQRT_MONTHLY_SCALING * Z_95;
}

/**
 * Given an account's USD-equivalent position and its annual vol, find the
 * minimum hedge ratio h ∈ [0..1] such that the residual 1-month VaR stays
 * under the target (TARGET_1M_VAR_FRACTION × |position|).
 *
 * Closed form: residual VaR = (1 - h) × VaR_unhedged. We want
 * (1 - h) × VaR_unhedged ≤ TARGET × |position|.
 */
function pickHedgeRatio(positionUsd: number, annualVol: number): number {
  const unhedged = var1mUsd(positionUsd, annualVol);
  const target = Math.abs(positionUsd) * TARGET_1M_VAR_FRACTION;
  if (unhedged <= target) return 0;
  const ratio = 1 - target / unhedged;
  // Round to the nearest 5% — treasury desks rarely trade in fractional bps.
  return Math.min(1, Math.max(0, Math.round(ratio * 20) / 20));
}

function recommendationFor(account: Account): FxHedgeRecommendation {
  const currency = account.currency as Currency;
  const annualVol = ANNUAL_VOL[currency] ?? 0;
  const positionUsd = convertAmount(account.balance, currency, "USD");
  const unhedgedVar = var1mUsd(positionUsd, annualVol);
  const hedgeRatio = pickHedgeRatio(positionUsd, annualVol);
  const hedgeNotional = Math.abs(positionUsd) * hedgeRatio;
  const annualCost = hedgeNotional * (HEDGE_COST_ANNUAL[currency] ?? 0);
  const residualVar = unhedgedVar * (1 - hedgeRatio);

  let action: HedgeAction;
  let reason: string;
  if (currency === "USD") {
    action = "no-action";
    reason = "USD base currency — no FX exposure to hedge.";
  } else if (Math.abs(positionUsd) < 50_000) {
    action = "no-action";
    reason = "Position is too small to justify hedging cost.";
  } else if (hedgeRatio === 0) {
    action = "monitor";
    reason = `Volatility (${(annualVol * 100).toFixed(1)}% p.a.) keeps 1m VaR inside the ${TARGET_1M_VAR_FRACTION * 100}% buffer. Monitor only.`;
  } else {
    action = "hedge";
    reason = `Hedge ${Math.round(hedgeRatio * 100)}% of position via ${currency}/USD forwards to bring 1-month 95% VaR from ${(unhedgedVar / 1000).toFixed(0)}K to ${(residualVar / 1000).toFixed(0)}K. Annual cost ≈ ${(annualCost / 1000).toFixed(1)}K USD.`;
  }

  return {
    accountId: account.id,
    accountName: account.name,
    bank: account.bank,
    currency,
    positionNative: account.balance,
    positionUsd,
    annualVol,
    unhedgedVar1mUsd: unhedgedVar,
    hedgeRatio,
    hedgeNotionalUsd: hedgeNotional,
    annualCostUsd: annualCost,
    residualVar1mUsd: residualVar,
    action,
    reason,
  };
}

/**
 * Compute hedge recommendations for every non-USD operational/reserve account.
 * Settlement accounts (Visa/Mastercard) are skipped — those positions clear out
 * to operating accounts the same day, so there's no overnight FX exposure to
 * hedge.
 */
export function computeFxHedgePlan(accounts: Account[]): FxHedgePlan {
  const recommendations = accounts
    .filter((a) => a.type !== "settlement")
    .map(recommendationFor);

  const summary: FxHedgeSummary = {
    totalExposureUsd: 0,
    totalUnhedgedVar1mUsd: 0,
    totalResidualVar1mUsd: 0,
    totalHedgeNotionalUsd: 0,
    totalAnnualCostUsd: 0,
    hedgesRecommended: 0,
  };
  for (const r of recommendations) {
    summary.totalExposureUsd += Math.abs(r.positionUsd);
    summary.totalUnhedgedVar1mUsd += r.unhedgedVar1mUsd;
    summary.totalResidualVar1mUsd += r.residualVar1mUsd;
    summary.totalHedgeNotionalUsd += r.hedgeNotionalUsd;
    summary.totalAnnualCostUsd += r.annualCostUsd;
    if (r.action === "hedge") summary.hedgesRecommended += 1;
  }
  // Sort: hedge recommendations first (by notional desc), then monitor, then none.
  recommendations.sort((a, b) => {
    const order = (x: HedgeAction) =>
      x === "hedge" ? 0 : x === "monitor" ? 1 : 2;
    const oa = order(a.action);
    const ob = order(b.action);
    if (oa !== ob) return oa - ob;
    return b.hedgeNotionalUsd - a.hedgeNotionalUsd;
  });
  return { summary, recommendations };
}
