"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ScrollText } from "lucide-react";
import { useAccountsStore } from "@/lib/store/accounts-store";
import { formatCompact } from "@/lib/utils/format";

interface AuditEvent {
  id: string;
  eventType: string;
  actorId: string | null;
  entityId: string;
  payload: Record<string, unknown> | null;
  occurredAt: string;
}

const POLL_MS = 15_000;

/**
 * Recent activity panel — surfaces the audit log inside the dashboard so
 * users see that transfers and scenario triggers actually leave traces.
 * Polls /api/v1/audit every 15s; also re-fetches when the accounts store
 * just synced (so a new transfer shows up promptly).
 */
export function ActivityPanel() {
  const lastSyncedAt = useAccountsStore((s) => s.lastSyncedAt);
  const [events, setEvents] = useState<AuditEvent[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchAudit() {
      try {
        const res = await fetch("/api/v1/audit?limit=8", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { events: AuditEvent[] };
        if (!cancelled) setEvents(data.events);
      } catch {
        // Silent — activity panel is non-critical.
      }
    }

    void fetchAudit();
    const id = window.setInterval(fetchAudit, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // When accounts store re-syncs (e.g., after a transfer), refresh audit too.
  useEffect(() => {
    if (lastSyncedAt === null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/audit?limit=8", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { events: AuditEvent[] };
        if (!cancelled) setEvents(data.events);
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lastSyncedAt]);

  return (
    <div className="rounded-lg border border-zinc-200/80 bg-white p-3">
      <div className="flex items-baseline justify-between pb-2">
        <h2 className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-900">
          <ScrollText className="h-3 w-3" strokeWidth={1.8} />
          Activity
        </h2>
        <span className="font-mono text-[10px] tabular-nums text-zinc-500">
          {events.length}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="rounded border border-dashed border-zinc-200 px-3 py-4 text-center">
          <p className="text-[11px] text-zinc-500">No recent activity.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {events.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </div>
      )}

      <div className="mt-2 border-t border-zinc-100 pt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-400">
        Audit log · refreshes every {POLL_MS / 1000}s
      </div>
    </div>
  );
}

function EventRow({ event }: { event: AuditEvent }) {
  const time = new Date(event.occurredAt);
  const relative = relativeTime(time);
  const payload = event.payload ?? {};

  if (event.eventType === "TRANSFER_EXECUTED") {
    const from = String(payload.from ?? "?");
    const to = String(payload.to ?? "?");
    const amount = Number(payload.amount ?? 0);
    const channel = String(payload.channel ?? "");
    const origin = String(payload.origin ?? "MANUAL");

    return (
      <div className="flex items-start gap-2 rounded border border-zinc-100 bg-zinc-50/40 px-2 py-1.5">
        <OriginBadge origin={origin} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 font-mono text-[10px] tabular-nums text-zinc-700">
            <span className="truncate text-zinc-900">{from}</span>
            <ArrowRight className="h-2.5 w-2.5 shrink-0 text-zinc-400" strokeWidth={2} />
            <span className="truncate text-zinc-900">{to}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] tabular-nums text-zinc-500">
            <span>{formatCompact(amount, "USD")}</span>
            <span className="text-zinc-300">·</span>
            <span className="uppercase tracking-[0.08em]">{channel}</span>
          </div>
        </div>
        <span className="shrink-0 font-mono text-[9px] tabular-nums text-zinc-400">
          {relative}
        </span>
      </div>
    );
  }

  if (event.eventType === "DATABASE_SEEDED") {
    return (
      <div className="flex items-center justify-between rounded border border-emerald-100 bg-emerald-50/40 px-2 py-1.5">
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-emerald-700">
          <span className="h-1 w-1 rounded-full bg-emerald-500" />
          Database seeded
        </div>
        <span className="font-mono text-[9px] tabular-nums text-zinc-400">
          {relative}
        </span>
      </div>
    );
  }

  // Generic fallback for any other audit event type.
  return (
    <div className="flex items-center justify-between rounded border border-zinc-100 px-2 py-1.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-700">
        {event.eventType.toLowerCase().replace(/_/g, " ")}
      </div>
      <span className="font-mono text-[9px] tabular-nums text-zinc-400">
        {relative}
      </span>
    </div>
  );
}

const ORIGIN_STYLE: Record<string, string> = {
  COMPASS: "bg-blue-50 text-blue-700 border-blue-200",
  OPTIMIZER: "bg-indigo-50 text-indigo-700 border-indigo-200",
  ALERT: "bg-amber-50 text-amber-700 border-amber-200",
  MANUAL: "bg-zinc-50 text-zinc-700 border-zinc-200",
};

function OriginBadge({ origin }: { origin: string }) {
  const cls = ORIGIN_STYLE[origin] ?? ORIGIN_STYLE.MANUAL;
  return (
    <span
      className={`mt-0.5 shrink-0 rounded border px-1 py-px font-mono text-[8px] uppercase tracking-[0.08em] ${cls}`}
    >
      {origin}
    </span>
  );
}

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 5) return "now";
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  return `${days}d`;
}
