import type { Currency, TransferChannel } from "@/types";

export interface OptimizerStep {
  from: string;
  to: string;
  amount: number;            // sent in donor's currency
  channel: TransferChannel;
  currency: Currency;        // donor currency
  fee: number;               // wire + FX spread (USD)
  fromLocation: [number, number];
  toLocation: [number, number];
  reason: string;
  fxApplied: boolean;
  receivedAmount: number;    // received in recipient's currency (= amount when same-currency)
  receivedCurrency: Currency;
}

export interface AccountPressure {
  accountId: string;
  currency: Currency;
  pressure: number;
  worstDayOffset: number;
  worstDeficit: number;
  supply: number;
}

export interface OptimizerPlan {
  steps: OptimizerStep[];
  totalFees: number;
  beforeDeficitDays: number;
  afterDeficitDays: number;
  beforePressureTotal: number;
  afterPressureTotal: number;
  pressuresBefore: AccountPressure[];
  pressuresAfter: AccountPressure[];
  iterations: number;
}
