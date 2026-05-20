export type AccountStatus = "healthy" | "warning" | "critical";
export type AccountType = "operational" | "settlement" | "reserve";
export type Currency = "EUR" | "USD" | "GBP" | "SGD" | "CHF";
export type TransferChannel = "SWIFT" | "SEPA" | "VISA" | "MASTERCARD";
export type TransferStatus =
  | "completed"
  | "pending"
  | "recommended"
  | "failed";
export type AlertSeverity = "info" | "warning" | "critical";

export interface Account {
  id: string;
  name: string;
  bank: string;
  location: [number, number];
  currency: Currency;
  balance: number;
  minBalance: number;
  type: AccountType;
  status: AccountStatus;
}

export interface Transfer {
  id: string;
  from: string;
  to: string;
  fromLocation: [number, number];
  toLocation: [number, number];
  channel: TransferChannel;
  amount: number;
  currency: Currency;
  status: TransferStatus;
  timestamp: string;
  // Optional FX fields — when present, donor pays `amount` in `currency`
  // and recipient receives `receivedAmount` in `receivedCurrency`.
  receivedAmount?: number;
  receivedCurrency?: Currency;
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  accountId: string;
  title: string;
  description: string;
  predictedDate: string;
  recommendedTransferId?: string;
  recommendedTransfer?: Transfer;
  confidence: number;
  createdAt: string;
}

export interface ForecastPoint {
  accountId: string;
  dayOffset: number;
  date: string;
  balance: number;
  p10: number;
  p90: number;
  isHistorical: boolean;
  pendingInflow: number;
  pendingOutflow: number;
}
