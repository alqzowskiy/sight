"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, ArrowRight, Triangle, Circle, Info } from "lucide-react";
import { useUiStore } from "@/lib/store/ui-store";
import { useAccountsStore } from "@/lib/store/accounts-store";
import { useTimeStore } from "@/lib/store/time-store";
import {
  getEffectiveBalanceAt,
  getEffectiveStatusAt,
  formatOffsetLabel,
} from "@/lib/utils/forecast";
import { formatCurrency, formatCompact, formatDateTime } from "@/lib/utils/format";
import { useState } from "react";
import { NumberTicker } from "./number-ticker";
import { AccountForecastChart } from "./account-forecast-chart";
import { AiInsightPanel } from "./ai-insight-panel";
import { buildInsightContext } from "@/lib/utils/insight-context";
import type { Alert } from "@/types";
import { useAlertsAt } from "@/lib/data/alerts";
import { Sparkles } from "lucide-react";
import { useCrisisStore } from "@/lib/store/crisis-store";

const SEVERITY: Record<
  Alert["severity"],
  { icon: typeof Triangle; color: string }
> = {
  critical: { icon: Triangle, color: "text-red-600" },
  warning: { icon: Circle, color: "text-amber-600" },
  info: { icon: Info, color: "text-zinc-500" },
};

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CHF: "CHF ",
  SGD: "S$",
};

export function AccountDetailPanel() {
  const open = useUiStore((s) => s.detailPanelOpen);
  const close = useUiStore((s) => s.closeDetailPanel);
  const accountId = useUiStore((s) => s.selectedAccountId);
  const accounts = useAccountsStore((s) => s.accounts);
  const transfers = useAccountsStore((s) => s.transfers);
  const offset = useTimeStore((s) => s.currentOffset);
  const alerts = useAlertsAt(offset);

  const account = accounts.find((a) => a.id === accountId);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <AnimatePresence>
      {open && account && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            className="fixed inset-0 z-40 bg-zinc-900/20 backdrop-blur-[2px]"
          />

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[460px] flex-col overflow-hidden border-l border-zinc-200 bg-white shadow-2xl"
          >
            <DetailContent
              account={account}
              transfers={transfers}
              alerts={alerts}
              offset={offset}
              close={close}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

interface DetailContentProps {
  account: NonNullable<ReturnType<typeof useAccountsStore.getState>["accounts"][number]>;
  transfers: ReturnType<typeof useAccountsStore.getState>["transfers"];
  alerts: Alert[];
  offset: number;
  close: () => void;
}

function DetailContent({
  account,
  transfers,
  alerts,
  offset,
  close,
}: DetailContentProps) {
  const city = account.name.split("·")[1]?.trim() ?? account.name;
  const symbol = CURRENCY_SYMBOL[account.currency] ?? `${account.currency} `;
  const liveBalance =
    offset === 0
      ? account.balance
      : getEffectiveBalanceAt(account, offset, account.balance);
  const liveStatus =
    offset === 0
      ? account.status
      : getEffectiveStatusAt(account, offset, account.balance);
  const isLow = liveBalance < account.minBalance;

  const relatedAlerts = alerts.filter((a) => a.accountId === account.id);
  const relatedTransfers = transfers
    .filter(
      (t) =>
        (t.from === account.id || t.to === account.id) &&
        t.status !== "recommended",
    )
    .slice(0, 5);

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-zinc-200/80 px-6 py-5">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
            {account.currency} · {city}
          </div>
          <div className="mt-1 text-[15px] font-medium text-zinc-900">
            {account.name}
          </div>
          <div className="mt-0.5 text-[12px] text-zinc-500">{account.bank}</div>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <section className="px-6 pb-6 pt-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div
                className={`font-mono text-[30px] font-medium tabular-nums tracking-tight ${
                  isLow ? "text-red-600" : "text-zinc-900"
                }`}
              >
                {symbol}
                <NumberTicker value={liveBalance} />
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                Min · {formatCurrency(account.minBalance, account.currency)}
                {offset !== 0 && (
                  <span className="ml-2 text-zinc-400">
                    · {formatOffsetLabel(offset)}
                  </span>
                )}
              </div>
            </div>
            <StatusPill status={liveStatus} />
          </div>
        </section>

        <section className="border-t border-zinc-200/80 px-6 py-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              30-day history · 14-day forecast
            </h3>
            <span className="font-mono text-[10px] tabular-nums text-zinc-400">
              {formatCompact(account.minBalance, account.currency)} min
            </span>
          </div>
          <AccountForecastChart account={account} />
        </section>

        {relatedAlerts.length > 0 && (
          <section className="border-t border-zinc-200/80 px-6 py-5">
            <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              Active alerts · {relatedAlerts.length}
            </h3>
            <div className="space-y-2">
              {relatedAlerts.map((a) => {
                const { icon: Icon, color } = SEVERITY[a.severity];
                return (
                  <div
                    key={a.id}
                    className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <Icon
                        className={`mt-[3px] h-3 w-3 shrink-0 ${color}`}
                        fill="currentColor"
                      />
                      <div>
                        <div className="text-[12px] font-medium text-zinc-900">
                          {a.title}
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                          {a.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {relatedTransfers.length > 0 && (
          <section className="border-t border-zinc-200/80 px-6 py-5">
            <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              Recent activity
            </h3>
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200/80 bg-white">
              {relatedTransfers.map((t) => {
                const outbound = t.from === account.id;
                return (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <ArrowRight
                        className={`h-3 w-3 ${
                          outbound ? "text-red-500" : "text-emerald-500"
                        }`}
                      />
                      <span className="text-zinc-700">
                        {outbound ? "to" : "from"}{" "}
                        <span className="text-zinc-900">
                          {accountCity(t.from === account.id ? t.to : t.from, transfers)}
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] tabular-nums text-zinc-700">
                        {formatCompact(t.amount, t.currency)}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-400">
                        {t.channel}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <InsightSection accountId={account.id} offset={offset} />

        <section className="border-t border-zinc-200/80 px-6 py-5">
          <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            Account details
          </h3>
          <dl className="space-y-2">
            <Row label="Type" value={account.type} mono />
            <Row label="Bank" value={account.bank} />
            <Row
              label="Updated"
              value={formatDateTime(new Date().toISOString())}
              mono
            />
            <Row label="Account ID" value={account.id} mono muted />
          </dl>
        </section>
      </div>
    </>
  );
}

function InsightSection({
  accountId,
  offset,
}: {
  accountId: string;
  offset: number;
}) {
  const [open, setOpen] = useState(false);
  const pendingInsightAccountId = useUiStore(
    (s) => s.pendingInsightAccountId,
  );
  const clearPendingInsight = useUiStore((s) => s.clearPendingInsight);
  const activeScenarios = useCrisisStore((s) => s.activeScenarios);
  const accounts = useAccountsStore((s) => s.accounts);
  const transfers = useAccountsStore((s) => s.transfers);

  useEffect(() => {
    if (pendingInsightAccountId === accountId) {
      setOpen(true);
      clearPendingInsight();
    }
  }, [pendingInsightAccountId, accountId, clearPendingInsight]);

  const liveAccount = accounts.find((a) => a.id === accountId);
  const recentTransfers = transfers.filter(
    (t) => t.to === accountId || t.from === accountId,
  );
  const context = buildInsightContext({
    accountId,
    liveBalance: liveAccount?.balance,
    transfers: recentTransfers,
    crisisScenarios: activeScenarios,
  });

  return (
    <section className="border-t border-zinc-200/80 px-6 py-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900"
      >
        <Sparkles className="h-3 w-3" />
        {open ? "Hide AI insight" : "Get AI insight"}
      </button>
      <AiInsightPanel
        accountId={accountId}
        dayOffset={offset}
        context={context}
        open={open}
      />
    </section>
  );
}

function accountCity(
  accountId: string,
  transfers: ReturnType<typeof useAccountsStore.getState>["transfers"],
): string {
  void transfers;
  return accountId.split("-").slice(1).join(" ").toUpperCase();
}

const PILL: Record<"healthy" | "warning" | "critical", string> = {
  healthy: "border-zinc-200 text-zinc-500",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  critical: "border-red-200 bg-red-50 text-red-700",
};

function StatusPill({ status }: { status: "healthy" | "warning" | "critical" }) {
  return (
    <span
      className={`rounded-full border px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.12em] ${PILL[status]}`}
    >
      {status}
    </span>
  );
}

function Row({
  label,
  value,
  mono,
  muted,
}: {
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
        {label}
      </span>
      <span
        className={`text-[12px] ${mono ? "font-mono" : ""} ${
          muted ? "text-zinc-400" : "text-zinc-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
