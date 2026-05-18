import type { Account, Currency, TransferChannel } from "@/types";
import type { AdHocTransferSpec } from "@/lib/store/accounts-store";
import { getEffectiveBalanceAt, getEffectiveStatusAt } from "./forecast";

function pickChannel(from: Currency, to: Currency): TransferChannel {
  if (from === to) {
    if (from === "EUR") return "SEPA";
    return "SWIFT";
  }
  return "SWIFT";
}

export function computeCompassTransfers(
  accounts: Account[],
  currentOffset: number,
): AdHocTransferSpec[] {
  const critical: Array<{ account: Account; deficit: number }> = [];
  for (const a of accounts) {
    if (a.minBalance === 0) continue;
    const status = getEffectiveStatusAt(a, currentOffset, a.balance);
    if (status !== "critical") continue;
    const target = a.minBalance * 1.2;
    const effective = getEffectiveBalanceAt(a, currentOffset, a.balance);
    const deficit = Math.max(0, target - effective);
    if (deficit > 0) critical.push({ account: a, deficit });
  }
  critical.sort((a, b) => b.deficit - a.deficit);

  const recipientIds = new Set(critical.map((c) => c.account.id));
  const donors: Array<{ account: Account; surplus: number }> = [];
  for (const a of accounts) {
    if (recipientIds.has(a.id)) continue;
    if (a.minBalance === 0) continue;
    const status = getEffectiveStatusAt(a, currentOffset, a.balance);
    if (status !== "healthy") continue;
    const buffer = Math.max(a.minBalance * 1.15, a.minBalance + 200_000);
    const effective = getEffectiveBalanceAt(a, currentOffset, a.balance);
    const surplus = effective - buffer;
    if (surplus > 200_000) donors.push({ account: a, surplus });
  }
  donors.sort((x, y) => y.surplus - x.surplus);

  const transfers: AdHocTransferSpec[] = [];
  for (const { account: needy, deficit } of critical) {
    let remaining = deficit;
    for (const d of donors) {
      if (remaining <= 0) break;
      if (d.surplus <= 200_000) continue;
      const draw = Math.min(remaining, d.surplus * 0.85);
      const amount = Math.round(draw / 10_000) * 10_000;
      if (amount < 100_000) continue;
      transfers.push({
        from: d.account.id,
        to: needy.id,
        fromLocation: d.account.location,
        toLocation: needy.location,
        channel: pickChannel(d.account.currency, needy.currency),
        amount,
        currency: needy.currency,
      });
      d.surplus -= amount;
      remaining -= amount;
    }
  }

  return transfers;
}

export function countCriticalAt(
  accounts: Account[],
  currentOffset: number,
): number {
  let n = 0;
  for (const a of accounts) {
    if (a.minBalance === 0) continue;
    if (getEffectiveStatusAt(a, currentOffset, a.balance) === "critical") n++;
  }
  return n;
}
