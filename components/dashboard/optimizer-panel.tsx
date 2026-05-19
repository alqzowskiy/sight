"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  CheckCircle2,
  Droplet,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAccountsStore } from "@/lib/store/accounts-store";
import { accountMetas } from "@/lib/data/accounts";
import { computeLiquidityGradientPlan } from "@/lib/optimizer/gradient";
import type { OptimizerPlan } from "@/lib/optimizer/types";
import { formatCompact } from "@/lib/utils/format";

interface OptimizerPanelProps {
  open: boolean;
  onClose: () => void;
}

const ACCENT = "#2563EB";
const EASE = [0.16, 1, 0.3, 1] as const;
const EXECUTE_STAGGER_MS = 220;

export function OptimizerPanel({ open, onClose }: OptimizerPanelProps) {
  const accounts = useAccountsStore((s) => s.accounts);
  const executeTransfer = useAccountsStore((s) => s.executeTransfer);
  const [executing, setExecuting] = useState(false);

  const plan: OptimizerPlan | null = useMemo(() => {
    if (!open) return null;
    return computeLiquidityGradientPlan(accounts);
  }, [open, accounts]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function nameFor(id: string): string {
    const meta = accountMetas.find((a) => a.id === id);
    return meta?.name ?? id;
  }
  function currencyFor(id: string): string {
    const meta = accountMetas.find((a) => a.id === id);
    return meta?.currency ?? "USD";
  }

  async function handleExecute() {
    if (!plan || plan.steps.length === 0) return;
    setExecuting(true);
    try {
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        const ok = executeTransfer({
          id: `opt-${Date.now().toString(36)}-${i}`,
          from: step.from,
          to: step.to,
          fromLocation: step.fromLocation,
          toLocation: step.toLocation,
          channel: step.channel,
          amount: step.amount,
          currency: step.currency,
          status: "completed",
          timestamp: new Date().toISOString(),
        });
        if (!ok) {
          toast.error(
            `Step ${i + 1} failed — insufficient funds in ${nameFor(step.from)}.`,
          );
          break;
        }
        await new Promise((r) => setTimeout(r, EXECUTE_STAGGER_MS));
      }
      toast.success(`Plan executed — ${plan.steps.length} transfers.`);
      onClose();
    } finally {
      setExecuting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && plan && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => !executing && onClose()}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="fixed left-1/2 top-1/2 z-50 w-[min(96vw,860px)] max-h-[88vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_30px_80px_rgba(0,0,0,0.18)]"
            role="dialog"
            aria-modal
          >
            <Header onClose={onClose} disabled={executing} />

            <div className="grid max-h-[calc(88vh-58px-72px)] grid-cols-1 gap-0 overflow-y-auto md:grid-cols-[1fr_320px]">
              <div className="px-6 py-5">
                <Explainer />
                <SummaryBar plan={plan} />
                <PlanList
                  plan={plan}
                  nameFor={nameFor}
                  currencyFor={currencyFor}
                />
              </div>

              <div className="border-l border-zinc-100 bg-zinc-50/60 px-5 py-5">
                <PressureColumn plan={plan} nameFor={nameFor} />
              </div>
            </div>

            <Footer
              plan={plan}
              executing={executing}
              onClose={onClose}
              onExecute={handleExecute}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Header({
  onClose,
  disabled,
}: {
  onClose: () => void;
  disabled: boolean;
}) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-100 bg-white px-6 py-3.5">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md"
          style={{ background: `${ACCENT}14`, color: ACCENT }}
        >
          <Droplet className="h-3.5 w-3.5" strokeWidth={1.8} />
        </span>
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-900">
            Liquidity Optimizer
          </div>
          <div className="text-[10px] text-zinc-500">
            Gradient flow · cross-account rebalance
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        disabled={disabled}
        aria-label="Close"
        className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </header>
  );
}

function Explainer() {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-4 py-3 text-[12px] leading-relaxed text-zinc-600">
      Each account has a{" "}
      <span className="font-mono text-zinc-900">pressure score</span> from the
      14-day forecast — high pressure means it&apos;ll dip below minimum soon.
      Liquidity flows from low-pressure surplus accounts to high-pressure
      deficit accounts, like fluid in a network of vessels.
    </div>
  );
}

function SummaryBar({ plan }: { plan: OptimizerPlan }) {
  const stats = [
    {
      kicker: "Transfers",
      value: String(plan.steps.length),
      tone: "default" as const,
    },
    {
      kicker: "Total fees",
      value: `$${Math.round(plan.totalFees).toLocaleString("en-US")}`,
      tone: "default" as const,
    },
    {
      kicker: "Deficit days",
      value: `${plan.beforeDeficitDays} → ${plan.afterDeficitDays}`,
      tone: plan.afterDeficitDays === 0 ? "good" : "warn",
    },
    {
      kicker: "Iterations",
      value: String(plan.iterations),
      tone: "default" as const,
    },
  ];
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.kicker}
          className={`rounded-lg border px-3 py-2.5 ${
            s.tone === "good"
              ? "border-emerald-200 bg-emerald-50/50"
              : s.tone === "warn"
                ? "border-amber-200 bg-amber-50/50"
                : "border-zinc-200 bg-white"
          }`}
        >
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">
            {s.kicker}
          </div>
          <div
            className={`mt-1 font-mono text-[15px] tabular-nums tracking-tight ${
              s.tone === "good"
                ? "text-emerald-700"
                : s.tone === "warn"
                  ? "text-amber-700"
                  : "text-zinc-900"
            }`}
          >
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlanList({
  plan,
  nameFor,
  currencyFor,
}: {
  plan: OptimizerPlan;
  nameFor: (id: string) => string;
  currencyFor: (id: string) => string;
}) {
  if (plan.steps.length === 0) {
    return (
      <div className="mt-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/40 px-4 py-3 text-[13px] text-emerald-700">
        <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
        All 11 accounts stay above minimum for the next 14 days. No transfers
        needed.
      </div>
    );
  }
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-700">
          Proposed plan
        </h3>
        <span className="font-mono text-[10px] tabular-nums text-zinc-400">
          execute top-down
        </span>
      </div>
      <ol className="space-y-1.5">
        {plan.steps.map((step, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.3,
              delay: 0.06 * i,
              ease: EASE,
            }}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-zinc-100 bg-white px-3 py-2.5"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-200 font-mono text-[9px] tabular-nums text-zinc-500">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-900">
                <span className="truncate">{nameFor(step.from)}</span>
                <ArrowRight
                  className="h-3 w-3 shrink-0 text-zinc-400"
                  strokeWidth={2}
                />
                <span className="truncate">{nameFor(step.to)}</span>
              </div>
              <div className="mt-0.5 text-[10px] text-zinc-500">
                {step.reason}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[13px] tabular-nums text-zinc-900">
                {formatCompact(step.amount, currencyFor(step.from))}
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400">
                {step.channel} · ${Math.round(step.fee).toLocaleString("en-US")}
              </div>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

function PressureColumn({
  plan,
  nameFor,
}: {
  plan: OptimizerPlan;
  nameFor: (id: string) => string;
}) {
  const ranked = useMemo(() => {
    return [...plan.pressuresBefore]
      .map((b) => {
        const after = plan.pressuresAfter.find(
          (a) => a.accountId === b.accountId,
        );
        return { before: b, after };
      })
      .sort((a, b) => b.before.pressure - a.before.pressure);
  }, [plan]);

  const maxPressure = Math.max(
    1,
    ...plan.pressuresBefore.map((p) => p.pressure),
  );

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-700">
          Pressure map
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
          before · after
        </span>
      </div>
      <div className="mt-3 space-y-1.5">
        {ranked.map(({ before, after }) => {
          const beforePct = (before.pressure / maxPressure) * 100;
          const afterPct = ((after?.pressure ?? 0) / maxPressure) * 100;
          const resolved =
            before.pressure > 0 && (after?.pressure ?? 0) < before.pressure * 0.05;
          return (
            <div key={before.accountId} className="text-[11px]">
              <div className="flex items-baseline justify-between gap-2 font-mono">
                <span className="truncate text-zinc-700">
                  {nameFor(before.accountId)}
                </span>
                <span
                  className={`tabular-nums ${
                    resolved ? "text-emerald-600" : "text-zinc-500"
                  }`}
                >
                  {Math.round(before.pressure).toLocaleString("en-US")} →{" "}
                  {Math.round(after?.pressure ?? 0).toLocaleString("en-US")}
                </span>
              </div>
              <div className="mt-1 flex h-[6px] items-stretch gap-0.5 overflow-hidden rounded-full bg-zinc-100">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${beforePct}%` }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="h-full"
                  style={{ background: "#FCA5A5" }}
                />
              </div>
              <div className="mt-0.5 flex h-[6px] items-stretch gap-0.5 overflow-hidden rounded-full bg-zinc-100">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${afterPct}%` }}
                  transition={{
                    duration: 0.6,
                    ease: EASE,
                    delay: 0.2,
                  }}
                  className="h-full"
                  style={{ background: ACCENT }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Footer({
  plan,
  executing,
  onClose,
  onExecute,
}: {
  plan: OptimizerPlan;
  executing: boolean;
  onClose: () => void;
  onExecute: () => void;
}) {
  const canExecute = plan.steps.length > 0 && !executing;
  return (
    <footer className="flex items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/50 px-5 py-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
        Esc to close
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={executing}
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-40"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={onExecute}
          disabled={!canExecute}
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          <Sparkles className="h-3 w-3" />
          {executing
            ? "Executing…"
            : plan.steps.length === 0
              ? "Nothing to do"
              : `Execute ${plan.steps.length} transfers`}
        </button>
      </div>
    </footer>
  );
}
