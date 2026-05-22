"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Play, Square, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  TOUR_SCRIPT,
  TOUR_DURATION_MS,
  stepAt,
  type TourStores,
} from "@/lib/demo/auto-tour";
import { useAccountsStore } from "@/lib/store/accounts-store";
import { useTimeStore } from "@/lib/store/time-store";
import { useCrisisStore } from "@/lib/store/crisis-store";
import { useUiStore } from "@/lib/store/ui-store";

const ease = [0.16, 1, 0.3, 1] as const;
const TICK_MS = 100;

function buildStores(): TourStores {
  return {
    accounts: {
      reset: () => useAccountsStore.getState().reset(),
      executeTransfer: (t) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useAccountsStore.getState().executeTransfer(t as any),
      addAndExecuteTransfer: (spec) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useAccountsStore.getState().addAndExecuteTransfer(spec as any),
      fetchFromApi: () => useAccountsStore.getState().fetchFromApi(),
    },
    time: {
      reset: () => useTimeStore.getState().reset(),
      setOffset: (n) => useTimeStore.getState().setOffset(n),
      getOffset: () => useTimeStore.getState().currentOffset,
    },
    crisis: {
      clearAll: () => useCrisisStore.getState().clearAll(),
      setOpen: (open) => useCrisisStore.getState().setCrisisModeOpen(open),
      activateCounterparty: (config) =>
        useCrisisStore.getState().activateCounterparty(config),
      deactivateCounterparty: () =>
        useCrisisStore.getState().deactivateCounterparty(),
    },
    ui: {
      setChatOpen: (open) => useUiStore.getState().setChatOpen(open),
      setSelectedAccount: (id) =>
        useUiStore.getState().setSelectedAccount(id),
      setCommandPaletteOpen: (open) =>
        useUiStore.getState().setCommandPaletteOpen(open),
    },
  };
}

export function AutoTourButton() {
  const [running, setRunning] = useState(false);
  const timeoutsRef = useRef<number[]>([]);
  const intervalRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);

  function start() {
    const stores = buildStores();
    startedAtRef.current = performance.now();
    setElapsed(0);
    setRunning(true);

    for (const step of TOUR_SCRIPT) {
      const id = window.setTimeout(() => {
        try {
          step.action({
            stores,
            toast: {
              info: (text, opts) => toast.message(text, opts),
              success: (text) => toast.success(text),
            },
            enqueue: (id) => timeoutsRef.current.push(id),
          });
        } catch (err) {
          console.error("[auto-tour] step failed:", err);
        }
      }, step.at);
      timeoutsRef.current.push(id);
    }

    intervalRef.current = window.setInterval(() => {
      const e = performance.now() - startedAtRef.current;
      setElapsed(e);
      if (e >= TOUR_DURATION_MS + 1500) {
        stop();
      }
    }, TICK_MS);

    // Hard stop fallback in case the interval fails.
    const finalStopId = window.setTimeout(stop, TOUR_DURATION_MS + 3000);
    timeoutsRef.current.push(finalStopId);
  }

  function stop() {
    for (const id of timeoutsRef.current) window.clearTimeout(id);
    timeoutsRef.current = [];
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
    setElapsed(0);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && running) {
        stop();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running]);

  useEffect(() => {
    return () => {
      for (const id of timeoutsRef.current) window.clearTimeout(id);
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  }, []);

  const current = stepAt(elapsed);
  const progress = Math.min(1, elapsed / TOUR_DURATION_MS);

  return (
    <>
      <button
        type="button"
        onClick={running ? stop : start}
        aria-label={running ? "Stop auto-tour" : "Start auto-tour"}
        title="60-second guided demo"
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
          running
            ? "border-purple-600 bg-purple-600 text-white"
            : "border-purple-200 bg-purple-50 text-purple-700 hover:border-purple-300"
        }`}
      >
        {running ? (
          <Square className="h-3 w-3" fill="currentColor" />
        ) : (
          <Play className="h-3 w-3" fill="currentColor" />
        )}
        <span className="hidden md:inline">{running ? "Stop tour" : "Auto-tour"}</span>
      </button>

      <AnimatePresence>
        {running && current && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.3, ease }}
            className="pointer-events-none fixed bottom-24 left-1/2 z-[60] w-full max-w-[520px] -translate-x-1/2 px-4"
          >
            <div className="pointer-events-auto rounded-2xl border border-purple-200 bg-white/95 shadow-xl backdrop-blur">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-600">
                  <Sparkles className="h-4 w-4 text-white" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-purple-700">
                      Auto-tour
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-zinc-400">
                      {(elapsed / 1000).toFixed(0)}s / {TOUR_DURATION_MS / 1000}s
                    </span>
                  </div>
                  <div className="mt-0.5 text-[13px] font-medium text-zinc-950">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={current.label}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.25 }}
                        className="inline-block"
                      >
                        {current.label}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                  {current.sub && (
                    <div className="mt-0.5 text-[11px] leading-snug text-zinc-500">
                      {current.sub}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={stop}
                  className="rounded border border-zinc-200 bg-white px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-600 transition-colors hover:bg-zinc-50"
                >
                  ESC
                </button>
              </div>
              <div className="h-1 overflow-hidden rounded-b-2xl bg-purple-100">
                <motion.div
                  className="h-full bg-purple-600"
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ ease: "linear", duration: TICK_MS / 1000 }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
