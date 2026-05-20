import type { Currency, TransferChannel, AccountType } from "@/types";
import { fxFeeUsd } from "./fx";

interface ChannelChoice {
  channel: TransferChannel;
  fee: number;
  fxApplied: boolean;
}

export function pickChannelAndFee(
  amount: number,
  from: { currency: Currency; type: AccountType },
  to: { currency: Currency; type: AccountType },
): ChannelChoice {
  if (from.currency !== to.currency) {
    // Cross-currency goes through SWIFT with an FX spread on top of the wire fee.
    const fx = fxFeeUsd(amount, from.currency, to.currency);
    return { channel: "SWIFT", fee: 25 + fx, fxApplied: true };
  }

  if (from.type === "settlement" && to.type === "settlement") {
    if (from.currency === "EUR") {
      return { channel: "VISA", fee: amount * 0.0008, fxApplied: false };
    }
    if (from.currency === "USD") {
      return {
        channel: "MASTERCARD",
        fee: amount * 0.0008,
        fxApplied: false,
      };
    }
  }

  if (from.currency === "EUR") {
    return { channel: "SEPA", fee: 0.5, fxApplied: false };
  }

  return { channel: "SWIFT", fee: 25, fxApplied: false };
}
