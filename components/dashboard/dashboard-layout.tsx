"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccountsStore } from "@/lib/store/accounts-store";
import { useTimeStore } from "@/lib/store/time-store";
import { useUiStore } from "@/lib/store/ui-store";
import {
  getEffectiveBalanceAt,
  getEffectiveStatusAt,
} from "@/lib/utils/forecast";
import { SightGlobe } from "@/components/sight/sight-globe";
import type {
  AccountMarker,
  SightGlobeHandle,
  TransferArc,
} from "@/components/sight/sight-globe";
import { AccountDetailPanel } from "./account-detail-panel";
import { AccountCard } from "./account-card";
import { AlertsPanel } from "./alerts-panel";
import { LiquidityScore } from "./liquidity-score";
import { TimeMachine } from "./time-machine";
import { motion } from "motion/react";
import { Search, RotateCcw, Send, Siren } from "lucide-react";
import { toast } from "sonner";
import { CrisisPanel } from "./crisis-panel";
import { CommandPalette } from "./command-palette";
import { DemoMode } from "./demo-mode";
import { NewTransferModal } from "./new-transfer-modal";
import { CompassBanner } from "./compass-banner";
import { ShortcutsOverlay } from "./shortcuts-overlay";
import { useCrisisStore } from "@/lib/store/crisis-store";
import { useAlertsAt } from "@/lib/data/alerts";
import { useInsightsStore } from "@/lib/store/insights-store";
import { MobileFallback } from "./mobile-fallback";

const ease = [0.16, 1, 0.3, 1] as const;

function panel(delay: number) {
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay, ease },
  };
}

function headerItem(delay: number) {
  return {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay, ease },
  };
}

export function DashboardLayout() {
  const accounts = useAccountsStore((s) => s.accounts);
  const transfers = useAccountsStore((s) => s.transfers);
  const lastExecutedTransferId = useAccountsStore(
    (s) => s.lastExecutedTransferId,
  );
  const resetAccounts = useAccountsStore((s) => s.reset);
  const resetTime = useTimeStore((s) => s.reset);
  const clearCrisis = useCrisisStore((s) => s.clearAll);
  const setCrisisModeOpen = useCrisisStore((s) => s.setCrisisModeOpen);
  const crisisModeOpen = useCrisisStore((s) => s.crisisModeOpen);
  const activeScenarios = useCrisisStore((s) => s.activeScenarios);
  const openCommandPalette = useUiStore((s) => s.setCommandPaletteOpen);
  const offset = useTimeStore((s) => s.currentOffset);
  const alerts = useAlertsAt(offset);

  const [newTransferOpen, setNewTransferOpen] = useState(false);
  const globeRef = useRef<SightGlobeHandle>(null);
  const seenAlertIdsRef = useRef<Set<string>>(new Set());
  const seenExecutedRef = useRef<string | null>(null);
  const hoveredAccountId = useUiStore((s) => s.hoveredAccountId);
  const setSelectedAccount = useUiStore((s) => s.setSelectedAccount);
  const openDetailPanel = useUiStore((s) => s.openDetailPanel);

  function handleResetDemo() {
    resetAccounts();
    resetTime();
    clearCrisis();
    setCrisisModeOpen(false);
    useUiStore.setState({
      detailPanelOpen: false,
      selectedAccountId: null,
      hoveredAccountId: null,
      hoveredTransferId: null,
      pendingInsightAccountId: null,
    });
    useInsightsStore.setState({ byKey: {}, inflight: {} });
    toast.success("Demo reset.");
  }

  const markers: AccountMarker[] = useMemo(
    () =>
      accounts.map((a) => {
        const city = a.name.split("·")[1]?.trim() ?? "";
        const balance =
          offset === 0
            ? a.balance
            : getEffectiveBalanceAt(a, offset, a.balance);
        const status =
          offset === 0
            ? a.status
            : getEffectiveStatusAt(a, offset, a.balance);
        return {
          id: a.id,
          location: a.location,
          label: `${a.currency} · ${city}`,
          city,
          balance,
          currency: a.currency,
          status,
        };
      }),
    [accounts, offset, activeScenarios],
  );

  // Seed seen alerts on mount so initial alerts don't all trigger pulses at once.
  useEffect(() => {
    for (const a of alerts) seenAlertIdsRef.current.add(a.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New alert appears → focus + alert pulse on the affected account.
  useEffect(() => {
    for (const a of alerts) {
      if (seenAlertIdsRef.current.has(a.id)) continue;
      seenAlertIdsRef.current.add(a.id);
      if (a.severity !== "critical" && a.severity !== "warning") continue;
      const acc = accounts.find((x) => x.id === a.accountId);
      if (!acc) return;
      globeRef.current?.focusOnLocation(acc.location, { zoom: true });
      if (a.severity === "critical") {
        globeRef.current?.triggerPulse(acc.location, "alert");
      }
    }
  }, [alerts, accounts]);

  // Compass / transfer execution → pulse at destination.
  useEffect(() => {
    if (!lastExecutedTransferId) return;
    if (seenExecutedRef.current === lastExecutedTransferId) return;
    seenExecutedRef.current = lastExecutedTransferId;
    const t = transfers.find((x) => x.id === lastExecutedTransferId);
    if (!t) return;
    globeRef.current?.triggerPulse(t.toLocation, "compass");
    globeRef.current?.focusOnLocation(t.toLocation, { zoom: false });
  }, [lastExecutedTransferId, transfers]);

  // Hovering an account card on sidebar gently rotates the globe to it.
  useEffect(() => {
    if (!hoveredAccountId) return;
    const acc = accounts.find((x) => x.id === hoveredAccountId);
    if (!acc) return;
    globeRef.current?.focusOnLocation(acc.location, { zoom: false });
  }, [hoveredAccountId, accounts]);

  const arcs: TransferArc[] = useMemo(() => {
    const baseArcs: TransferArc[] = transfers
      .filter((t) => {
        if (t.status === "completed" || t.status === "pending") return true;
        if (t.status === "recommended" && offset > 0) return true;
        return false;
      })
      .map((t) => ({
        id: t.id,
        from: t.fromLocation,
        to: t.toLocation,
        channel: t.channel,
        amount: t.amount,
        currency: t.currency,
        recommended:
          t.status === "recommended" || t.id === lastExecutedTransferId,
      }));

    if (offset > 0) {
      for (const alert of alerts) {
        const r = alert.recommendedTransfer;
        if (!r) continue;
        if (baseArcs.some((a) => a.id === r.id)) continue;
        baseArcs.push({
          id: r.id,
          from: r.fromLocation,
          to: r.toLocation,
          channel: r.channel,
          amount: r.amount,
          currency: r.currency,
          recommended: true,
        });
      }
    }
    return baseArcs;
  }, [transfers, offset, lastExecutedTransferId, alerts]);

  return (
    <div className="grid h-screen min-h-0 grid-rows-[56px_1fr_96px] bg-[#FAFAFA]">
      <header className="flex items-center justify-between border-b border-zinc-200/80 bg-white px-6">
        <motion.div
          {...headerItem(0)}
          className="flex items-center gap-3"
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-900">
            NovaPay
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-300">
            /
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-900">
            Dashboard
          </span>
        </motion.div>

        <motion.div
          {...headerItem(0.08)}
          className="flex items-center gap-5"
        >
          <LiquidityScore />
          <button
            type="button"
            onClick={() => openCommandPalette(true)}
            aria-label="Open command palette"
            className="flex items-center gap-2 rounded-md border border-zinc-200/80 bg-white px-2.5 py-1.5 text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-700"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={1.6} />
            <span className="font-mono text-[10px] uppercase tracking-[0.1em]">
              Search
            </span>
            <kbd className="ml-2 rounded border border-zinc-200 px-1 font-mono text-[9px] text-zinc-500">
              ⌘K
            </kbd>
          </button>
          <button
            type="button"
            onClick={() => setNewTransferOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200/80 bg-white px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900"
          >
            <Send className="h-3 w-3" strokeWidth={1.7} />
            New Transfer
          </button>
          <button
            type="button"
            onClick={() => setCrisisModeOpen(!crisisModeOpen)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200/80 bg-white px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900"
          >
            <Siren className="h-3 w-3" strokeWidth={1.7} />
            Crisis
            {activeScenarios.length > 0 && (
              <span className="rounded bg-red-50 px-1 font-mono text-[9px] text-red-700">
                {activeScenarios.length}
              </span>
            )}
          </button>
          <DemoMode />
          <button
            type="button"
            onClick={handleResetDemo}
            aria-label="Reset demo"
            className="flex items-center gap-1.5 rounded-md border border-zinc-200/80 bg-white px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-900"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={1.6} />
            Reset
          </button>
          <div
            aria-label="User"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 font-mono text-[10px] uppercase tracking-wider text-white"
          >
            NP
          </div>
        </motion.div>
      </header>

      <div className="flex min-h-0 flex-col gap-3 p-4">
        <CompassBanner />
        <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)_360px] gap-4">
          <motion.div
            {...panel(0.1)}
            className="min-h-0 overflow-y-auto rounded-xl border border-zinc-200/80 bg-white/60 p-4"
          >
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              Accounts · {accounts.length}
            </div>
            <div className="flex flex-col gap-2">
              {accounts.map((a) => (
                <AccountCard key={a.id} account={a} />
              ))}
            </div>
          </motion.div>

          <motion.div
            {...panel(0.18)}
            className="relative flex min-h-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200/80 bg-white"
          >
            <div className="absolute left-4 top-4 z-10">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                Live Network
              </div>
              <div className="mt-1 text-[13px] font-medium text-zinc-900">
                NovaPay treasury map
              </div>
            </div>
            <div className="absolute right-4 top-4 z-10 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-900" />
                Healthy
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Warning
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                Critical
              </span>
            </div>
            <div className="aspect-square h-full max-h-full w-auto max-w-full">
              <SightGlobe
                ref={globeRef}
                markers={markers}
                arcs={arcs}
                onMarkerClick={({ location }) => {
                  const [lat, lng] = location;
                  const matches = accounts.filter(
                    (a) =>
                      Math.abs(a.location[0] - lat) < 0.2 &&
                      Math.abs(a.location[1] - lng) < 0.2,
                  );
                  if (matches.length === 0) return;
                  // Prefer the operational account if a cluster has many.
                  const target =
                    matches.find((a) => a.type === "operational") ?? matches[0];
                  setSelectedAccount(target.id);
                  openDetailPanel(target.id);
                }}
              />
            </div>
            <div className="absolute bottom-4 left-4 z-10 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
              {markers.length} accounts · {arcs.length} active flows
            </div>
            <div className="absolute bottom-4 right-4 z-10 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
              Drag · Scroll · 0 to reset
            </div>
          </motion.div>

          <motion.div
            {...panel(0.14)}
            className="min-h-0 overflow-hidden rounded-xl border border-zinc-200/80 bg-white/60 p-4"
          >
            <AlertsPanel />
          </motion.div>
        </div>
      </div>

      <motion.div
        {...panel(0.3)}
        className="border-t border-zinc-200/80 bg-white"
      >
        <TimeMachine />
      </motion.div>

      <AccountDetailPanel />
      <CrisisPanel />
      <CommandPalette />
      <ShortcutsOverlay />
      <MobileFallback />
      <NewTransferModal
        open={newTransferOpen}
        onClose={() => setNewTransferOpen(false)}
      />
    </div>
  );
}
