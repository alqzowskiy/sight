"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldAlert, X } from "lucide-react";
import { useCrisisStore } from "@/lib/store/crisis-store";
import { useAccountsStore } from "@/lib/store/accounts-store";
import { useTimeStore } from "@/lib/store/time-store";
import { formatCompact } from "@/lib/utils/format";

const COUNTERPARTY_ID = "counterparty-default";
const ease = [0.16, 1, 0.3, 1] as const;

/**
 * Persistent top-of-page banner that appears whenever the counterparty-default
 * scenario is active. Shows the failing bank, frozen positions, and recovery
 * countdown. This is the visceral "something is on fire" indicator.
 */
export function CounterpartyBanner() {
  const active = useCrisisStore((s) => s.activeScenarios);
  const config = useCrisisStore((s) => s.counterpartyConfig);
  const toggleScenario = useCrisisStore((s) => s.toggleScenario);
  const setConfig = useCrisisStore((s) => s.setCounterpartyConfig);
  const accounts = useAccountsStore((s) => s.accounts);
  const offset = useTimeStore((s) => s.currentOffset);

  const isOn = active.includes(COUNTERPARTY_ID);

  const frozen = useMemo(() => {
    if (!config) return { count: 0, totalUsd: 0, currencies: [] as string[] };
    const affected = accounts.filter((a) => a.bank === config.bank);
    const totalUsd = affected.reduce((sum, a) => sum + a.balance, 0);
    const currencies = Array.from(new Set(affected.map((a) => a.currency)));
    return { count: affected.length, totalUsd, currencies };
  }, [accounts, config]);

  if (!isOn || !config) return null;

  const daysRemaining = Math.max(0, config.recoveryDays - Math.max(0, offset));
  const stage =
    offset <= 0
      ? "armed"
      : daysRemaining > 0
        ? "freeze"
        : offset < config.recoveryDays + 3
          ? "recovery"
          : "settled";

  const stageCopy: Record<typeof stage, { headline: string; sub: string }> = {
    armed: {
      headline: "Counterparty default armed",
      sub: "Advance Time Machine to see the cascade",
    },
    freeze: {
      headline: `${config.bank} in default`,
      sub: `${frozen.count} accounts frozen · recovery in ${daysRemaining}d`,
    },
    recovery: {
      headline: `${config.bank} positions recovering`,
      sub: `Treasury redistribution in progress · settles in ~3d`,
    },
    settled: {
      headline: `${config.bank} positions restored`,
      sub: "Cascade resolved. Concentration normalized.",
    },
  };
  const { headline, sub } = stageCopy[stage];

  const tone = stage === "armed" || stage === "settled" ? "amber" : "red";

  return (
    <AnimatePresence>
      <motion.div
        layout
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease }}
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
          tone === "red"
            ? "border-red-300 bg-red-50/80"
            : "border-amber-300 bg-amber-50/80"
        }`}
      >
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            tone === "red" ? "bg-red-600" : "bg-amber-500"
          }`}
        >
          <ShieldAlert className="h-5 w-5 text-white" strokeWidth={1.8} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                tone === "red" ? "text-red-700" : "text-amber-700"
              }`}
            >
              Counterparty default
            </span>
            {stage === "freeze" && (
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[14px] font-medium text-zinc-900">
            {headline}
          </div>
          <div className="mt-0.5 font-mono text-[11px] tabular-nums text-zinc-600">
            {sub}
          </div>
        </div>

        {frozen.totalUsd > 0 && (
          <div className="hidden text-right md:block">
            <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">
              Frozen
            </div>
            <div className="mt-0.5 font-mono text-[18px] tabular-nums text-red-700">
              {formatCompact(frozen.totalUsd, "USD")}
            </div>
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500">
              {frozen.currencies.join(" · ")}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            toggleScenario(COUNTERPARTY_ID);
            setConfig(null);
          }}
          aria-label="Deactivate counterparty scenario"
          className="rounded p-1 text-zinc-500 transition-colors hover:bg-white/60 hover:text-zinc-900"
        >
          <X className="h-4 w-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
