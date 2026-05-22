/**
 * Banking adapter — production integration surface (design specification).
 *
 * The demo serves static JSON from public/data/. In production, the same
 * shape comes from a Postgres-backed pipeline (see prisma/schema.prisma).
 *
 * Account balances and transactions in Postgres are kept fresh by a nightly
 * cron that calls one of the concrete adapters below. The Python ML pipeline
 * then runs on the updated data and rewrites the JSON snapshot consumed by
 * the UI tier.
 *
 * Why an adapter layer:
 *   - Each banking integration has different auth, payload, and rate-limit
 *     semantics. Hiding this behind a uniform interface keeps the rest of
 *     the system unaware.
 *   - Compliance-sensitive code (PSD2 AISP, OAuth consent, certificate auth)
 *     stays scoped to the adapter — the core treasury logic doesn't need to
 *     know about it.
 *   - Adapters are independently deployable: a Halyk update doesn't ship a
 *     Plaid update.
 *
 * None of these are implemented in v1. The interface exists so we can move
 * from synthetic data to real data without touching the UI or ML layers.
 */

import type { AccountType, Currency, TransferChannel } from "@/types";

// -----------------------------------------------------------------------------
// Domain shapes used by adapters
// -----------------------------------------------------------------------------

/** Generic account row as returned by a banking adapter. */
export interface AdapterAccount {
  /** Adapter-stable identifier (IBAN, account number, internal ID). */
  externalId: string;
  name: string;
  bank: string;
  currency: Currency;
  country: string;
  type: AccountType;
  /** Geolocation for the Globe. */
  location: [number, number];
}

/** Live balance snapshot. */
export interface AdapterBalance {
  externalId: string;
  /** Available (not pending) balance, in account currency. */
  available: number;
  /** Optional bookkeeping balance (may differ from available during settlement). */
  ledger?: number;
  /** Provider's timestamp for this snapshot. */
  asOf: string;
}

/** Generic transaction row. */
export interface AdapterTransaction {
  externalId: string;
  accountExternalId: string;
  /** Positive = inflow, negative = outflow. */
  amount: number;
  currency: Currency;
  channel: TransferChannel | "INTERNAL";
  /** Free-form party identifier from the source bank. */
  counterparty?: string;
  timestamp: string;
}

/** Transfer instruction submitted to the adapter for execution. */
export interface TransferInstruction {
  /** Sight transfer id — used for idempotency on retry. */
  sightTransferId: string;
  fromExternalId: string;
  toExternalId: string;
  amount: number;
  currency: Currency;
  channel: TransferChannel;
  /** Optional human-readable reference (shows up on the bank statement). */
  reference?: string;
}

/** Bank acknowledgement of a transfer submission. */
export interface TransferResult {
  /** Provider's tracking id. */
  providerId: string;
  status: "ACCEPTED" | "REJECTED" | "PENDING_APPROVAL";
  /** Estimated settlement timestamp, if the channel provides one. */
  estimatedSettlement?: string;
  /** Reason for rejection if status === "REJECTED". */
  rejectionReason?: string;
}

// -----------------------------------------------------------------------------
// Adapter interface
// -----------------------------------------------------------------------------

/**
 * All banking integrations must implement this interface. The cron pipeline
 * is unaware of which concrete adapter is in use.
 */
export interface BankingAdapter {
  /** Unique identifier for diagnostics, e.g., "plaid", "halyk", "kaspi-b2b". */
  readonly id: string;

  /** Coverage region(s) advertised by this adapter. Used for routing. */
  readonly regions: ReadonlyArray<"CIS" | "EU" | "MENA" | "SEA" | "US">;

  /** List the accounts this credential bundle can see. */
  listAccounts(): Promise<AdapterAccount[]>;

  /**
   * Fetch the latest available + ledger balance for a set of accounts.
   * Implementations should batch where possible.
   */
  fetchBalances(externalIds: string[]): Promise<AdapterBalance[]>;

  /**
   * Pull transactions in [`since`, `until`) for an account.
   * `until` is exclusive so daily pages don't double-count.
   */
  fetchTransactions(
    externalId: string,
    since: Date,
    until?: Date,
  ): Promise<AdapterTransaction[]>;

  /**
   * Submit a transfer for execution. Must be idempotent on `sightTransferId`
   * (the bank should reject a retry with the same id rather than execute twice).
   *
   * In Co-pilot mode, this is only called after a human has clicked Execute.
   * The adapter MUST NOT execute autonomously.
   */
  submitTransfer(transfer: TransferInstruction): Promise<TransferResult>;

  /**
   * Poll the status of a previously submitted transfer. Used by the
   * reconciliation cron to flip Sight's local status from PENDING → COMPLETED.
   */
  pollTransfer(providerId: string): Promise<TransferResult>;
}

// -----------------------------------------------------------------------------
// Concrete adapters — roadmap (none implemented in v1)
// -----------------------------------------------------------------------------

/**
 * Adapter roadmap. Each entry maps to a planned class implementing the
 * BankingAdapter interface above.
 *
 * Y1:
 *   - HalykOpenBankingAdapter      — KZ corporate (Halyk Bank, primary partner)
 *   - KaspiB2BAdapter              — KZ retail & SMB (Kaspi Bank B2B API)
 *
 * Y2:
 *   - PlaidAdapter                 — US/EU consumer & SMB (Plaid Production)
 *   - GoCardlessAdapter            — EU SEPA (GoCardless Open Banking)
 *   - TrueLayerAdapter             — UK Open Banking (TrueLayer)
 *
 * Y3:
 *   - SwiftGPIAdapter              — SWIFT GPI tracking for cross-border
 *   - SaudiSAMAOpenBankingAdapter  — MENA expansion (ОАЭ DIFC + Saudi)
 *   - SingaporeSGFinDexAdapter     — SEA (Singapore SGFinDex consent framework)
 *
 * Each adapter ships with its own:
 *   - OAuth or certificate-based auth flow
 *   - Rate-limit / circuit breaker
 *   - Per-partner SLA + retry policy
 *   - Compliance attestation (PSD2 AISP, MAS DPT, etc.)
 */
export const ADAPTER_ROADMAP = [
  "halyk-open-banking",
  "kaspi-b2b",
  "plaid",
  "gocardless",
  "truelayer",
  "swift-gpi",
  "sama-open-banking",
  "sgfindex",
] as const;

export type AdapterId = (typeof ADAPTER_ROADMAP)[number];
