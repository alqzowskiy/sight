import type { Currency, TransferChannel } from "@/types";

export interface OptimizerStep {
  from: string;
  to: string;
  amount: number;
  channel: TransferChannel;
  currency: Currency;
  fee: number;
  fromLocation: [number, number];
  toLocation: [number, number];
  reason: string;
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
