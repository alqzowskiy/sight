import { z } from "zod";

// Single source of truth for all API request/response shapes.
// Imported by both client (fetch wrappers) and server (route handlers).

export const CurrencySchema = z.enum([
  "USD",
  "EUR",
  "GBP",
  "SGD",
  "CHF",
  "KZT",
  "AED",
  "JPY",
]);
export type Currency = z.infer<typeof CurrencySchema>;

export const AccountTypeSchema = z.enum([
  "operational",
  "settlement",
  "reserve",
  "fx_hedge",
]);

export const TransferChannelSchema = z.enum([
  "SEPA_INSTANT",
  "SEPA_STANDARD",
  "SEPA",
  "SWIFT",
  "VISA",
  "MASTERCARD",
  "INTERNAL",
]);

export const TransferOriginSchema = z.enum([
  "ALERT",
  "COMPASS",
  "OPTIMIZER",
  "MANUAL",
]);

export const TransferStatusSchema = z.enum([
  "RECOMMENDED",
  "PENDING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

// -----------------------------------------------------------------------------
// Account
// -----------------------------------------------------------------------------

export const AccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  bank: z.string(),
  currency: CurrencySchema,
  country: z.string(),
  city: z.string().optional(),
  location: z.tuple([z.number(), z.number()]),
  balance: z.number(),
  minBalance: z.number(),
  type: AccountTypeSchema,
  status: z.enum(["healthy", "warning", "critical"]),
  /** True when this account's forecasts came from the naive baseline
   *  generator (no trained ensemble yet). UI shows "ML warming up" badge. */
  isBaseline: z.boolean().optional(),
});

export type AccountDTO = z.infer<typeof AccountSchema>;

export const AccountsResponseSchema = z.object({
  accounts: z.array(AccountSchema),
});

export const CreateAccountSchema = z.object({
  name: z.string().min(1).max(80),
  bank: z.string().min(1).max(60),
  currency: CurrencySchema,
  country: z.string().length(2),
  city: z.string().min(1).max(60).optional(),
  location: z.tuple([z.number(), z.number()]),
  balance: z.number().finite(),
  minBalance: z.number().min(0).finite(),
  type: AccountTypeSchema,
});

export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;

// -----------------------------------------------------------------------------
// Forecasts
// -----------------------------------------------------------------------------

export const ForecastPointSchema = z.object({
  date: z.string(),
  balance: z.number(),
  p10: z.number(),
  p90: z.number(),
  isHistorical: z.boolean(),
});

export const ForecastsResponseSchema = z.object({
  accountId: z.string(),
  modelChoice: z.string(),
  modelVersion: z.string(),
  points: z.array(ForecastPointSchema),
});

// -----------------------------------------------------------------------------
// Transfers
// -----------------------------------------------------------------------------

export const CreateTransferSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: z.number().positive().finite(),
  channel: TransferChannelSchema.optional(),
  origin: TransferOriginSchema.default("MANUAL"),
  reason: z.string().max(280).optional(),
});

export type CreateTransferInput = z.infer<typeof CreateTransferSchema>;

export const TransferDTOSchema = z.object({
  id: z.string(),
  fromAccountId: z.string(),
  toAccountId: z.string(),
  amount: z.number(),
  amountCurrency: CurrencySchema,
  receivedAmount: z.number().nullable(),
  receivedCurrency: z.string().nullable(),
  channel: TransferChannelSchema,
  status: TransferStatusSchema,
  origin: TransferOriginSchema,
  reason: z.string().nullable(),
  createdAt: z.string(),
  executedAt: z.string().nullable(),
});

export type TransferDTO = z.infer<typeof TransferDTOSchema>;

export const TransfersResponseSchema = z.object({
  transfers: z.array(TransferDTOSchema),
});

export const CreateTransferResponseSchema = z.object({
  transfer: TransferDTOSchema,
  accounts: z.array(AccountSchema),
});

// -----------------------------------------------------------------------------
// Alerts (computed from forecasts)
// -----------------------------------------------------------------------------

export const AlertDTOSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  predictedDate: z.string(),
  predictedDeficit: z.number(),
  confidence: z.number(),
  recommendedDonorId: z.string().optional(),
  recommendedAmount: z.number().optional(),
  recommendedChannel: TransferChannelSchema.optional(),
  reason: z.string(),
});

export const AlertsResponseSchema = z.object({
  alerts: z.array(AlertDTOSchema),
});

// -----------------------------------------------------------------------------
// Concentration (HHI)
// -----------------------------------------------------------------------------

export const ConcentrationDimensionSchema = z.enum([
  "bank",
  "currency",
  "country",
]);

export const ConcentrationBucketSchema = z.object({
  key: z.string(),
  balance: z.number(),
  share: z.number(),
  accounts: z.number(),
});

export const ConcentrationResponseSchema = z.object({
  dimension: ConcentrationDimensionSchema,
  hhi: z.number(),
  level: z.enum(["low", "moderate", "high"]),
  breakdown: z.array(ConcentrationBucketSchema),
  totalUsd: z.number(),
});

// -----------------------------------------------------------------------------
// Audit
// -----------------------------------------------------------------------------

export const AuditEventSchema = z.object({
  id: z.string(),
  eventType: z.string(),
  actorId: z.string().nullable(),
  entityId: z.string(),
  payload: z.unknown(),
  occurredAt: z.string(),
});

export const AuditResponseSchema = z.object({
  events: z.array(AuditEventSchema),
  total: z.number(),
});

// -----------------------------------------------------------------------------
// Errors
// -----------------------------------------------------------------------------

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
