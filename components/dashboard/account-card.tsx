"use client";

import type { Account } from "@/types";
import { NumberTicker } from "./number-ticker";
import { useUiStore } from "@/lib/store/ui-store";
import { useTimeStore } from "@/lib/store/time-store";
import { useAccountsStore } from "@/lib/store/accounts-store";
import { useCrisisStore } from "@/lib/store/crisis-store";
import {
  getEffectiveBalanceAt,
  getEffectiveStatusAt,
} from "@/lib/utils/forecast";
import { getAnomaliesForAccount } from "@/lib/data/forecasts";
import { formatCurrency } from "@/lib/utils/format";
import { AlertTriangle } from "lucide-react";

const DOT: Record<Account["status"], string> = {
  healthy: "bg-zinc-900",
  warning: "bg-amber-500",
  critical: "bg-red-600",
};

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CHF: "CHF ",
  SGD: "S$",
};

export function AccountCard({ account }: { account: Account }) {
  const selected = useUiStore((s) => s.selectedAccountId === account.id);
  const setHovered = useUiStore((s) => s.setHoveredAccount);
  const openDetail = useUiStore((s) => s.openDetailPanel);
  const offset = useTimeStore((s) => s.currentOffset);
  const storeAccounts = useAccountsStore((s) => s.accounts);
  useCrisisStore((s) => s.activeScenarios);

  const liveAccount = storeAccounts.find((a) => a.id === account.id) ?? account;
  const currentBalance =
    offset === 0
      ? liveAccount.balance
      : getEffectiveBalanceAt(account, offset, liveAccount.balance);
  const currentStatus =
    offset === 0
      ? liveAccount.status
      : getEffectiveStatusAt(account, offset, liveAccount.balance);

  const isLow = currentBalance < account.minBalance;
  const city = account.name.split("·")[1]?.trim() ?? account.name;
  const symbol = CURRENCY_SYMBOL[account.currency] ?? `${account.currency} `;
  const anomalies = getAnomaliesForAccount(account.id);
  const anomalyCount = anomalies.length;

  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(account.id)}
      onMouseLeave={() => setHovered(null)}
      onClick={() => openDetail(account.id)}
      className={`group relative w-full rounded-lg border bg-white p-3 text-left transition-all hover:bg-zinc-50 ${
        selected ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200/80"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${DOT[currentStatus]}`}
          />
          <div className="min-w-0">
            <div className="truncate font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-900">
              {account.currency} · {city}
            </div>
            <div className="truncate text-[11px] text-zinc-500">
              {account.bank}
            </div>
          </div>
        </div>
        <StatusPill status={currentStatus} />
      </div>

      <div className="mt-3">
        <div
          className={`font-mono text-[18px] tabular-nums tracking-tight transition-colors ${
            isLow ? "text-red-600" : "text-zinc-900"
          }`}
        >
          {symbol}
          <NumberTicker value={currentBalance} />
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2 font-mono text-[10px] tabular-nums text-zinc-500">
          <span>Min · {formatCurrency(account.minBalance, account.currency)}</span>
          {anomalyCount > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50/60 px-1.5 py-px text-amber-700"
              title={`${anomalyCount} anomalous transactions detected by IsolationForest in the last 90 days`}
            >
              <AlertTriangle className="h-2.5 w-2.5" strokeWidth={2} />
              {anomalyCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

const PILL: Record<Account["status"], string> = {
  healthy: "border-zinc-200 text-zinc-500",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  critical: "border-red-200 bg-red-50 text-red-700",
};

function StatusPill({ status }: { status: Account["status"] }) {
  return (
    <span
      className={`rounded-full border px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.12em] ${PILL[status]}`}
    >
      {status}
    </span>
  );
}
