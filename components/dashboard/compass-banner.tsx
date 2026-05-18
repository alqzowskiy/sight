"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Compass, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useAccountsStore } from "@/lib/store/accounts-store";
import { useTimeStore } from "@/lib/store/time-store";
import { useCrisisStore } from "@/lib/store/crisis-store";
import {
  computeCompassTransfers,
  countCriticalAt,
} from "@/lib/utils/sight-compass";

const STAGGER_MS = 250;
const ease = [0.16, 1, 0.3, 1] as const;

export function CompassBanner() {
  const accounts = useAccountsStore((s) => s.accounts);
  const addAndExecuteTransfer = useAccountsStore(
    (s) => s.addAndExecuteTransfer,
  );
  const offset = useTimeStore((s) => s.currentOffset);
  const activeScenarios = useCrisisStore((s) => s.activeScenarios);
  const [running, setRunning] = useState(false);

  const criticalCount = useMemo(
    () => countCriticalAt(accounts, offset),
    [accounts, offset, activeScenarios],
  );

  const compassTransfers = useMemo(
    () => computeCompassTransfers(accounts, offset),
    [accounts, offset, activeScenarios],
  );

  const shouldShow =
    criticalCount >= 2 && compassTransfers.length > 0 && !running;

  function handleApply() {
    if (running) return;
    setRunning(true);
    const transfers = compassTransfers;
    transfers.forEach((spec, i) => {
      window.setTimeout(() => {
        addAndExecuteTransfer(spec);
        if (i === transfers.length - 1) {
          window.setTimeout(() => {
            toast.success(
              `Compass rebalanced ${transfers.length} ${
                transfers.length === 1 ? "account" : "accounts"
              }. All clear.`,
            );
            setRunning(false);
          }, 300);
        }
      }, i * STAGGER_MS);
    });
  }

  return (
    <AnimatePresence initial={false}>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.28, ease }}
          className="overflow-hidden"
        >
          <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50/70 px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-red-600 text-white">
                <Compass className="h-3.5 w-3.5" />
              </span>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-red-700">
                  {criticalCount} accounts at risk
                </div>
                <div className="text-[12px] leading-snug text-zinc-900">
                  Sight Compass can rebalance now with{" "}
                  {compassTransfers.length}{" "}
                  {compassTransfers.length === 1 ? "transfer" : "transfers"}.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleApply}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
            >
              {running ? "Rebalancing…" : "Apply Compass"}
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
