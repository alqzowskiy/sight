import type { Currency, TransferChannel, AccountType } from "@/types";

interface ChannelChoice {
  channel: TransferChannel;
  fee: number;
}

export function pickChannelAndFee(
  amount: number,
  from: { currency: Currency; type: AccountType },
  to: { currency: Currency; type: AccountType },
): ChannelChoice | null {
  if (from.currency !== to.currency) return null;

  if (from.type === "settlement" && to.type === "settlement") {
    if (from.currency === "EUR") {
      return { channel: "VISA", fee: amount * 0.0008 };
    }
    if (from.currency === "USD") {
      return { channel: "MASTERCARD", fee: amount * 0.0008 };
    }
  }

  if (from.currency === "EUR") {
    return { channel: "SEPA", fee: 0.5 };
  }

  return { channel: "SWIFT", fee: 25 };
}
