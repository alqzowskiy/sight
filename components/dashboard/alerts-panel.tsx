"use client";

import { useTimeStore } from "@/lib/store/time-store";
import { useAlertsAt } from "@/lib/data/alerts";
import { AlertCard } from "./alert-card";

export function AlertsPanel() {
  const offset = useTimeStore((s) => s.currentOffset);
  const alerts = useAlertsAt(offset);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between px-1 pb-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-900">
          Alerts
        </h2>
        <span className="font-mono text-[10px] tabular-nums text-zinc-500">
          {alerts.length}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {alerts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 p-6 text-center">
            <p className="text-[12px] text-zinc-500">All clear.</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
              No predicted shortfalls
            </p>
          </div>
        ) : (
          alerts.map((a) => <AlertCard key={a.id} alert={a} />)
        )}
      </div>
    </div>
  );
}
