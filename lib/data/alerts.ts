"use client";

import { useMemo } from "react";
import type { Account, Alert, AlertSeverity, Transfer, TransferChannel } from "@/types";
import { useAccountsStore } from "@/lib/store/accounts-store";
import {
  getEffectiveBalanceAt,
  getDateForOffset,
} from "@/lib/utils/forecast";
import { formatCompact } from "@/lib/utils/format";

const HORIZON_DAYS = 7;
const BUFFER_RATIO = 1.2;
const SEVERITY_RANK: Record<AlertSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

const EU_COUNTRIES = new Set(["DE", "FR", "IT", "ES", "NL", "BE", "AT", "IE"]);

function pickChannel(
  donor: Account,
  recipient: Account,
  donorCountry: string,
  recipientCountry: string,
): TransferChannel {
  if (donor.currency === "EUR" && recipient.currency === "EUR") {
    if (EU_COUNTRIES.has(donorCountry) && EU_COUNTRIES.has(recipientCountry)) {
      return "SEPA";
    }
  }
  return "SWIFT";
}

function findDonor(
  recipient: Account,
  accounts: Account[],
  offset: number,
  amountNeeded: number,
): Account | undefined {
  type Scored = {
    account: Account;
    surplus: number;
    sameCurrency: boolean;
    canFully: boolean;
  };
  const candidates: Scored[] = [];
  for (const a of accounts) {
    if (a.id === recipient.id) continue;
    const balance = getEffectiveBalanceAt(a, offset, a.balance);
    const floor = a.minBalance > 0 ? a.minBalance : 0;
    const surplus = balance - floor;
    if (surplus <= 0) continue;
    candidates.push({
      account: a,
      surplus,
      sameCurrency: a.currency === recipient.currency,
      canFully: surplus >= amountNeeded,
    });
  }
  candidates.sort((a, b) => {
    if (a.canFully !== b.canFully) return a.canFully ? -1 : 1;
    if (a.sameCurrency !== b.sameCurrency) return a.sameCurrency ? -1 : 1;
    return b.surplus - a.surplus;
  });
  return candidates[0]?.account;
}

function countryFor(account: Account): string {
  const [lat, lng] = account.location;
  if (account.currency === "EUR") {
    if (Math.abs(lat - 48.85) < 1 && Math.abs(lng - 2.35) < 1) return "FR";
    return "DE";
  }
  if (account.currency === "USD") return "US";
  if (account.currency === "GBP") return "GB";
  if (account.currency === "SGD") return "SG";
  if (account.currency === "CHF") return "CH";
  return "US";
}

function buildRecommendedTransfer(
  recipient: Account,
  donor: Account,
  amount: number,
): Transfer {
  const donorCountry = countryFor(donor);
  const recipientCountry = countryFor(recipient);
  const channel = pickChannel(donor, recipient, donorCountry, recipientCountry);
  return {
    id: `rec-${recipient.id}`,
    from: donor.id,
    to: recipient.id,
    fromLocation: donor.location,
    toLocation: recipient.location,
    channel,
    amount,
    currency: recipient.currency,
    status: "recommended",
    timestamp: new Date().toISOString(),
  };
}

export function generateAlertsAt(
  accounts: Account[],
  baseOffset: number,
  dismissedAccountIds: Record<string, true>,
): Alert[] {
  const alerts: Alert[] = [];
  const today = getDateForOffset(0).getTime();

  for (const account of accounts) {
    if (dismissedAccountIds[account.id]) continue;
    if (account.minBalance === 0) continue;

    let worstHorizon = 0;
    let worstBalance = Infinity;
    for (let h = 0; h <= HORIZON_DAYS; h++) {
      const b = getEffectiveBalanceAt(account, baseOffset + h, account.balance);
      if (b < worstBalance) {
        worstBalance = b;
        worstHorizon = h;
      }
    }
    if (worstBalance >= account.minBalance) continue;

    const severity: AlertSeverity =
      worstBalance < account.minBalance * 0.5 ? "critical" : "warning";
    const deficit = account.minBalance - worstBalance;
    const need = Math.round(deficit * BUFFER_RATIO);

    const donor = findDonor(account, accounts, baseOffset, need);
    const recommendedTransfer = donor
      ? buildRecommendedTransfer(account, donor, need)
      : undefined;

    const predictedDate = getDateForOffset(baseOffset + worstHorizon).toISOString();
    const horizonLabel =
      worstHorizon === 0
        ? "today"
        : worstHorizon === 1
          ? "1 day"
          : `${worstHorizon} days`;
    const confidence = Math.max(0.5, 0.92 - worstHorizon * 0.03);

    alerts.push({
      id: `alert-${account.id}`,
      severity,
      accountId: account.id,
      title: `${account.name} projected below minimum`,
      description: `Balance projected to drop to ${formatCompact(worstBalance, account.currency)} in ${horizonLabel}. Minimum is ${formatCompact(account.minBalance, account.currency)}.`,
      predictedDate,
      recommendedTransferId: recommendedTransfer?.id,
      recommendedTransfer,
      confidence,
      createdAt: new Date(today).toISOString(),
    });
  }

  alerts.sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  );
  return alerts;
}

export function useAlertsAt(offset: number): Alert[] {
  const accounts = useAccountsStore((s) => s.accounts);
  const dismissedAccountIds = useAccountsStore(
    (s) => s.dismissedAccountIds,
  );
  return useMemo(
    () => generateAlertsAt(accounts, offset, dismissedAccountIds),
    [accounts, offset, dismissedAccountIds],
  );
}
