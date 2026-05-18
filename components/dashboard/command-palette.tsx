"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Command } from "cmdk";
import { toast } from "sonner";
import {
  ArrowRight,
  Clock,
  FlaskConical,
  RotateCcw,
  Siren,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import { useAccountsStore } from "@/lib/store/accounts-store";
import { useTimeStore } from "@/lib/store/time-store";
import { useCrisisStore } from "@/lib/store/crisis-store";
import { useUiStore } from "@/lib/store/ui-store";
import {
  computeCompassTransfers,
  countCriticalAt,
} from "@/lib/utils/sight-compass";

const ease = [0.16, 1, 0.3, 1] as const;
const STAGGER_MS = 220;

export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const accounts = useAccountsStore((s) => s.accounts);
  const resetAccounts = useAccountsStore((s) => s.reset);
  const addAndExecuteTransfer = useAccountsStore(
    (s) => s.addAndExecuteTransfer,
  );
  const resetTime = useTimeStore((s) => s.reset);
  const setOffset = useTimeStore((s) => s.setOffset);
  const togglePlay = useTimeStore((s) => s.togglePlay);
  const setCrisisModeOpen = useCrisisStore((s) => s.setCrisisModeOpen);
  const crisisModeOpen = useCrisisStore((s) => s.crisisModeOpen);
  const activeScenarios = useCrisisStore((s) => s.activeScenarios);
  const clearCrisis = useCrisisStore((s) => s.clearAll);
  const openDetail = useUiStore((s) => s.openDetailPanel);
  const requestInsight = useUiStore((s) => s.requestInsight);
  const offset = useTimeStore((s) => s.currentOffset);
  const router = useRouter();

  const criticalCount = useMemo(
    () => countCriticalAt(accounts, offset),
    [accounts, offset, activeScenarios],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  function run(fn: () => void) {
    return () => {
      fn();
      setOpen(false);
    };
  }

  function handleResetDemo() {
    resetAccounts();
    resetTime();
    clearCrisis();
    setCrisisModeOpen(false);
    toast.success("Demo reset.");
  }

  function handleApplyCompass() {
    const transfers = computeCompassTransfers(accounts, offset);
    if (transfers.length === 0) {
      toast("No critical accounts.");
      return;
    }
    const recipients = new Set(transfers.map((t) => t.to));
    transfers.forEach((spec, i) => {
      window.setTimeout(() => addAndExecuteTransfer(spec), i * STAGGER_MS);
    });
    window.setTimeout(
      () =>
        toast.success(
          `Sight Compass rebalanced ${recipients.size} account${
            recipients.size > 1 ? "s" : ""
          }. All clear.`,
        ),
      transfers.length * STAGGER_MS + 80,
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[80] bg-zinc-950/30 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.22, ease }}
            className="fixed left-1/2 top-[18%] z-[81] w-[560px] max-w-[92vw] -translate-x-1/2 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
          >
            <Command label="Command Palette" className="text-zinc-100">
              <div className="border-b border-zinc-800/80 px-4 py-3">
                <Command.Input
                  placeholder="Type a command..."
                  className="w-full bg-transparent font-mono text-[13px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
                />
              </div>
              <Command.List className="max-h-[360px] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-6 text-center font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-500">
                  No results
                </Command.Empty>

                <Command.Group
                  heading="Actions"
                  className="text-zinc-500 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em]"
                >
                  <PaletteItem
                    icon={Siren}
                    label={
                      crisisModeOpen ? "Close Crisis Mode" : "Open Crisis Mode"
                    }
                    onSelect={run(() => setCrisisModeOpen(!crisisModeOpen))}
                  />
                  <PaletteItem
                    icon={Target}
                    label="Apply Sight Compass"
                    hint={
                      criticalCount > 0
                        ? `${criticalCount} at risk`
                        : "all clear"
                    }
                    disabled={criticalCount === 0}
                    onSelect={run(handleApplyCompass)}
                  />
                  <PaletteItem
                    icon={RotateCcw}
                    label="Reset Demo"
                    onSelect={run(handleResetDemo)}
                  />
                  <PaletteItem
                    icon={FlaskConical}
                    label="Show Sight Lab"
                    hint="backtest metrics"
                    onSelect={run(() => router.push("/dashboard/lab"))}
                  />
                </Command.Group>

                <Command.Group
                  heading="Time Machine"
                  className="text-zinc-500 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em]"
                >
                  <PaletteItem
                    icon={Clock}
                    label="Jump to Today"
                    onSelect={run(() => setOffset(0))}
                  />
                  <PaletteItem
                    icon={Clock}
                    label="Jump to +3 days"
                    onSelect={run(() => setOffset(3))}
                  />
                  <PaletteItem
                    icon={Clock}
                    label="Jump to +7 days"
                    onSelect={run(() => setOffset(7))}
                  />
                  <PaletteItem
                    icon={Clock}
                    label="Jump to +14 days"
                    onSelect={run(() => setOffset(14))}
                  />
                  <PaletteItem
                    icon={Clock}
                    label="Play/Pause"
                    onSelect={run(togglePlay)}
                  />
                </Command.Group>

                <Command.Group
                  heading="Accounts"
                  className="text-zinc-500 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em]"
                >
                  {accounts.map((a) => {
                    const city = a.name.split("·")[1]?.trim() ?? a.name;
                    return (
                      <PaletteItem
                        key={a.id}
                        icon={Wallet}
                        label={`Open ${a.currency} · ${city}`}
                        hint={a.bank}
                        onSelect={run(() => openDetail(a.id))}
                      />
                    );
                  })}
                </Command.Group>

                <Command.Group
                  heading="AI insights"
                  className="text-zinc-500 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em]"
                >
                  {accounts.map((a) => {
                    const city = a.name.split("·")[1]?.trim() ?? a.name;
                    return (
                      <PaletteItem
                        key={`ai-${a.id}`}
                        icon={Sparkles}
                        label={`Ask Sight about ${a.currency} · ${city}`}
                        hint="gpt-4o-mini"
                        onSelect={run(() => requestInsight(a.id))}
                      />
                    );
                  })}
                </Command.Group>
              </Command.List>
              <div className="flex items-center justify-between border-t border-zinc-800/80 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" /> to select
                </span>
                <span>Esc to close</span>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface PaletteItemProps {
  icon: typeof Clock;
  label: string;
  hint?: string;
  disabled?: boolean;
  onSelect: () => void;
}

function PaletteItem({
  icon: Icon,
  label,
  hint,
  disabled,
  onSelect,
}: PaletteItemProps) {
  return (
    <Command.Item
      onSelect={onSelect}
      disabled={disabled}
      className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 font-mono text-[12px] text-zinc-200 aria-selected:bg-zinc-800 aria-selected:text-white data-[disabled]:cursor-not-allowed data-[disabled]:text-zinc-600"
    >
      <span className="flex items-center gap-2.5">
        <Icon className="h-3 w-3 text-zinc-400" strokeWidth={1.6} />
        {label}
      </span>
      {hint && (
        <span className="text-[10px] uppercase tracking-[0.1em] text-zinc-500">
          {hint}
        </span>
      )}
    </Command.Item>
  );
}
