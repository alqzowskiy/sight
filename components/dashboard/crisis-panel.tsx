"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useCrisisStore } from "@/lib/store/crisis-store";
import { useAccountsStore } from "@/lib/store/accounts-store";
import { useTimeStore } from "@/lib/store/time-store";
import { crisisScenarios } from "@/lib/data/crisis-scenarios";
import { crisisImpact } from "@/lib/utils/scoring";

const ease = [0.16, 1, 0.3, 1] as const;

export function CrisisPanel() {
  const open = useCrisisStore((s) => s.crisisModeOpen);
  const setOpen = useCrisisStore((s) => s.setCrisisModeOpen);
  const active = useCrisisStore((s) => s.activeScenarios);
  const toggleScenario = useCrisisStore((s) => s.toggleScenario);
  const clearAll = useCrisisStore((s) => s.clearAll);
  const accounts = useAccountsStore((s) => s.accounts);
  const offset = useTimeStore((s) => s.currentOffset);

  const impact = useMemo(
    () => crisisImpact(accounts, offset),
    [accounts, offset, active],
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-zinc-900/10 backdrop-blur-[1px]"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.35, ease }}
            className="fixed right-0 top-0 z-50 flex h-screen w-[380px] flex-col border-l border-zinc-200 bg-white shadow-xl"
          >
            <header className="flex items-start justify-between border-b border-zinc-200/80 px-6 py-5">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                  Sandbox
                </div>
                <h2 className="mt-1 text-[15px] font-medium text-zinc-900">
                  Crisis Mode
                </h2>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
                  Simulate stress scenarios. Toggle on to see how Sight responds.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 space-y-2 overflow-y-auto px-6 py-5">
              {crisisScenarios.map((s) => {
                const isOn = active.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleScenario(s.id)}
                    className={`w-full rounded-lg border bg-white p-3 text-left transition-colors hover:border-zinc-300 ${
                      isOn
                        ? "border-red-300 bg-red-50/50"
                        : "border-zinc-200/80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-900">
                          {s.name}
                        </div>
                        <div className="mt-1 text-[12px] leading-snug text-zinc-500">
                          {s.description}
                        </div>
                      </div>
                      <ToggleDot on={isOn} />
                    </div>
                  </button>
                );
              })}
            </div>

            <footer className="border-t border-zinc-200/80 px-6 py-4">
              <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.12em]">
                <span className="text-zinc-400">Active scenarios</span>
                <span className="tabular-nums text-zinc-900">
                  {active.length}
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.12em]">
                <span className="text-zinc-400">Liquidity impact</span>
                <span
                  className={`tabular-nums ${
                    impact > 0 ? "text-red-600" : "text-zinc-900"
                  }`}
                >
                  {impact > 0 ? `-${impact}` : "0"} pts
                </span>
              </div>
              <button
                type="button"
                onClick={clearAll}
                disabled={active.length === 0}
                className="mt-4 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-300 disabled:hover:border-zinc-200"
              >
                Clear All
              </button>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function ToggleDot({ on }: { on: boolean }) {
  return (
    <span
      className={`mt-0.5 inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
        on ? "bg-red-600" : "bg-zinc-200"
      }`}
    >
      <motion.span
        layout
        transition={{ duration: 0.18, ease }}
        className={`block h-3 w-3 rounded-full bg-white shadow-sm ${
          on ? "ml-auto" : ""
        }`}
      />
    </span>
  );
}
