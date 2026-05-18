"use client";

import { useEffect } from "react";
import { Play, Square } from "lucide-react";
import { toast } from "sonner";
import { useAccountsStore } from "@/lib/store/accounts-store";
import { useTimeStore } from "@/lib/store/time-store";
import { useCrisisStore } from "@/lib/store/crisis-store";
import { useDemoStore } from "@/lib/store/demo-store";
import { computeCompassTransfers } from "@/lib/utils/sight-compass";
import { generateAlertsAt } from "@/lib/data/alerts";

const STAGGER_MS = 220;
const LOOP_MS = 62_000;

type Step = { at: number; action: () => void };

function animateOffset(target: number, durationMs: number) {
  const start = useTimeStore.getState().currentOffset;
  if (start === target) return;
  const startedAt = performance.now();
  function tick(now: number) {
    const t = Math.min(1, (now - startedAt) / durationMs);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = Math.round(start + (target - start) * eased);
    useTimeStore.getState().setOffset(value);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function runScript(onTimeoutId: (id: number) => void) {
  const accountsStore = useAccountsStore.getState();
  const timeStore = useTimeStore.getState();
  const crisisStore = useCrisisStore.getState();

  const steps: Step[] = [
    {
      at: 0,
      action: () => {
        accountsStore.reset();
        timeStore.reset();
        crisisStore.clearAll();
        crisisStore.setCrisisModeOpen(false);
      },
    },
    {
      at: 6_000,
      action: () => animateOffset(3, 1_400),
    },
    {
      at: 12_000,
      action: () => {
        const state = useAccountsStore.getState();
        const currentOffset = useTimeStore.getState().currentOffset;
        const alerts = generateAlertsAt(
          state.accounts,
          currentOffset,
          state.dismissedAccountIds,
        );
        const nycAlert = alerts.find((a) => a.accountId === "usd-nyc");
        if (nycAlert?.recommendedTransfer) {
          state.executeTransfer(nycAlert.recommendedTransfer);
          toast.success("Resolved. NYC back in the green.");
        }
      },
    },
    {
      at: 18_000,
      action: () => animateOffset(0, 900),
    },
    {
      at: 22_000,
      action: () => useCrisisStore.getState().setCrisisModeOpen(true),
    },
    {
      at: 25_000,
      action: () => useCrisisStore.getState().toggleScenario("black-friday"),
    },
    {
      at: 30_000,
      action: () => useCrisisStore.getState().toggleScenario("swift-outage"),
    },
    {
      at: 36_000,
      action: () => useCrisisStore.getState().setCrisisModeOpen(false),
    },
    {
      at: 38_000,
      action: () => {
        const accounts = useAccountsStore.getState().accounts;
        const offset = useTimeStore.getState().currentOffset;
        const transfers = computeCompassTransfers(accounts, offset);
        const recipients = new Set(transfers.map((t) => t.to));
        transfers.forEach((spec, i) => {
          const id = window.setTimeout(
            () => useAccountsStore.getState().addAndExecuteTransfer(spec),
            i * STAGGER_MS,
          );
          onTimeoutId(id);
        });
        const toastId = window.setTimeout(
          () =>
            toast.success(
              `Sight Compass rebalanced ${recipients.size} accounts. All clear.`,
            ),
          transfers.length * STAGGER_MS + 80,
        );
        onTimeoutId(toastId);
      },
    },
    {
      at: 55_000,
      action: () => {
        useAccountsStore.getState().reset();
        useTimeStore.getState().reset();
        useCrisisStore.getState().clearAll();
      },
    },
  ];

  for (const step of steps) {
    const id = window.setTimeout(step.action, step.at);
    onTimeoutId(id);
  }
}

export function DemoMode() {
  const isRunning = useDemoStore((s) => s.isRunning);
  const toggle = useDemoStore((s) => s.toggle);

  useEffect(() => {
    if (!isRunning) return;
    const timeouts: number[] = [];
    const onId = (id: number) => timeouts.push(id);

    runScript(onId);
    const loopId = window.setInterval(() => runScript(onId), LOOP_MS);
    timeouts.push(loopId);

    return () => {
      for (const id of timeouts) window.clearTimeout(id);
      window.clearInterval(loopId);
    };
  }, [isRunning]);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isRunning ? "Stop demo" : "Start demo"}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
        isRunning
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200/80 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-900"
      }`}
    >
      {isRunning ? (
        <Square className="h-3 w-3" fill="currentColor" />
      ) : (
        <Play className="h-3 w-3" fill="currentColor" />
      )}
      Demo
    </button>
  );
}
