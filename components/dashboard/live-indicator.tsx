"use client";

import { useEffect, useState } from "react";
import { useAccountsStore } from "@/lib/store/accounts-store";

const POLL_INTERVAL_MS = 30_000;
const TICK_INTERVAL_MS = 1_000;

/**
 * Tiny "Live · synced Ns ago" pill in the header that:
 *   1. Polls the API every 30s to keep the store in sync with the database.
 *      This makes multi-tab updates work: a transfer executed in one tab
 *      shows up in another within 30 seconds without manual refresh.
 *   2. Ticks every second to show the freshness of the snapshot.
 *
 * Tab visibility is respected — polling pauses when the tab is hidden so
 * we don't burn cycles for nothing.
 */
export function LiveIndicator() {
  const lastSyncedAt = useAccountsStore((s) => s.lastSyncedAt);
  const syncing = useAccountsStore((s) => s.syncing);
  const hydrated = useAccountsStore((s) => s.hydrated);
  const fetchFromApi = useAccountsStore((s) => s.fetchFromApi);
  const [now, setNow] = useState(() => Date.now());

  // Polling loop — refresh every POLL_INTERVAL_MS while the tab is visible.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let pollId: number | null = null;

    function schedule() {
      if (pollId !== null) window.clearTimeout(pollId);
      pollId = window.setTimeout(() => {
        if (document.visibilityState === "visible") {
          void fetchFromApi();
        }
        schedule();
      }, POLL_INTERVAL_MS);
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        // Tab became visible — fetch immediately and reschedule.
        void fetchFromApi();
        schedule();
      } else if (pollId !== null) {
        window.clearTimeout(pollId);
        pollId = null;
      }
    }

    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (pollId !== null) window.clearTimeout(pollId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchFromApi]);

  // 1Hz tick so the "Ns ago" label stays accurate.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  if (!hydrated) {
    return (
      <span
        className="hidden items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500 lg:inline-flex"
        title="Connecting to live database…"
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400" />
        Connecting
      </span>
    );
  }

  const elapsedSec = lastSyncedAt ? Math.max(0, Math.floor((now - lastSyncedAt) / 1000)) : 0;
  const label = elapsedSec < 5 ? "just now" : `${elapsedSec}s ago`;
  const stale = elapsedSec > POLL_INTERVAL_MS / 1000 + 5;

  return (
    <span
      className={`hidden items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] lg:inline-flex ${
        stale
          ? "border-amber-200 bg-amber-50/70 text-amber-700"
          : "border-emerald-200 bg-emerald-50/70 text-emerald-700"
      }`}
      title={`Polling /api/v1/* every ${POLL_INTERVAL_MS / 1000}s · last sync ${label}`}
    >
      <span className="relative inline-flex h-1.5 w-1.5">
        {syncing && (
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-60" />
        )}
        <span
          className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
            stale ? "bg-amber-500" : "bg-emerald-500"
          }`}
        />
      </span>
      Live · {label}
    </span>
  );
}
