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
import { ConcentrationCard } from "./concentration-card";
import { ActivityPanel } from "./activity-panel";
import { LiquidityScore } from "./liquidity-score";
import { TimeMachine } from "./time-machine";
import { motion } from "motion/react";
import { Search, RotateCcw, Siren, Settings as SettingsIcon, Network } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { toast } from "sonner";
import { CrisisPanel } from "./crisis-panel";
import { CommandPalette } from "./command-palette";
import { AutoTourButton } from "./auto-tour";
import { LiveIndicator } from "./live-indicator";
import { FxHedgePanel } from "./fx-hedge-panel";
import { FloatingCopilotButton } from "./floating-copilot-button";
import { HeaderActionsMenu } from "./header-actions-menu";
import { computeConnectionWeb } from "@/lib/globe/connection-web";
import { AddAccountPanel } from "./add-account-panel";
import { NewTransferModal } from "./new-transfer-modal";
import { OptimizerPanel } from "./optimizer-panel";
import { CompassBanner } from "./compass-banner";
import { CounterpartyBanner } from "./counterparty-banner";
import { AiChatPanel } from "./ai-chat-panel";
import { ShortcutsOverlay } from "./shortcuts-overlay";
import { SettingsPanel } from "./settings-panel";
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
  const fetchFromApi = useAccountsStore((s) => s.fetchFromApi);
  const hydrated = useAccountsStore((s) => s.hydrated);
  const tenant = useAccountsStore((s) => s.tenant);
  const [connectionsVisible, setConnectionsVisible] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const totalAnomalyCount = useAccountsStore((s) =>
    Object.values(s.anomaliesByAccount).reduce(
      (sum, arr) => sum + arr.length,
      0,
    ),
  );
  const isDemoTenant = tenant?.isDemo === true;

  // Hydrate from the API on first mount so state persists across page refreshes.
  // The initial render uses the static JSON snapshot for SSR; once mounted we
  // immediately replace it with the live DB state.
  useEffect(() => {
    void fetchFromApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const resetTime = useTimeStore((s) => s.reset);
  const clearCrisis = useCrisisStore((s) => s.clearAll);
  const setCrisisModeOpen = useCrisisStore((s) => s.setCrisisModeOpen);
  const crisisModeOpen = useCrisisStore((s) => s.crisisModeOpen);
  const activeScenarios = useCrisisStore((s) => s.activeScenarios);
  const counterpartyConfig = useCrisisStore((s) => s.counterpartyConfig);
  const openCommandPalette = useUiStore((s) => s.setCommandPaletteOpen);
  const offset = useTimeStore((s) => s.currentOffset);
  const alerts = useAlertsAt(offset);

  const [newTransferOpen, setNewTransferOpen] = useState(false);
  const [optimizerOpen, setOptimizerOpen] = useState(false);
  const [hedgeOpen, setHedgeOpen] = useState(false);
  const globeRef = useRef<SightGlobeHandle>(null);
  const seenAlertIdsRef = useRef<Set<string>>(new Set());
  const seenExecutedRef = useRef<string | null>(null);
  const hoveredAccountId = useUiStore((s) => s.hoveredAccountId);
  const setSelectedAccount = useUiStore((s) => s.setSelectedAccount);
  const openDetailPanel = useUiStore((s) => s.openDetailPanel);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);

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

  // Connection web: aggregate transfer history into bank-pair edges so the
  // globe can render risk-contagion arcs on top of markers. Pure math, cheap
  // to recompute when transfers change.
  const connectionWeb = useMemo(
    () => computeConnectionWeb(transfers),
    [transfers],
  );

  const markers: AccountMarker[] = useMemo(
    () =>
      accounts.map((a) => {
        // Marker label prefers the explicit `account.city` (set when the user
        // creates the account through onboarding). Falls back to parsing the
        // legacy "Company CCY · City" naming used by NovaPay seed accounts,
        // then to the bank name so we never end up with a bare currency.
        const parsedCity = a.name.split("·")[1]?.trim();
        const city = a.city || parsedCity || a.bank;
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

  // Counterparty default activation → sequential cinematic red pulses on each
  // affected account in succession. This is the visceral "watch SVB happen"
  // moment in the demo.
  const lastCounterpartyBankRef = useRef<string | null>(null);
  useEffect(() => {
    if (!counterpartyConfig) {
      lastCounterpartyBankRef.current = null;
      return;
    }
    if (lastCounterpartyBankRef.current === counterpartyConfig.bank) return;
    lastCounterpartyBankRef.current = counterpartyConfig.bank;

    const affected = accounts.filter((a) => a.bank === counterpartyConfig.bank);
    if (affected.length === 0) return;

    // Stagger pulses 180ms apart so the cascade reads as a wave rolling across
    // the globe rather than all markers blinking at once.
    affected.forEach((acc, i) => {
      const delay = 180 * i;
      const isFirst = i === 0;
      window.setTimeout(() => {
        if (isFirst) {
          globeRef.current?.focusOnLocation(acc.location, { zoom: true });
        }
        globeRef.current?.triggerPulse(acc.location, "alert");
      }, delay);
    });
  }, [counterpartyConfig, accounts]);

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
    <div className="flex min-h-screen flex-col bg-[#FAFAFA] lg:grid lg:h-screen lg:min-h-0 lg:grid-rows-[56px_1fr_96px]">
      <header className="flex items-center justify-between gap-2 border-b border-zinc-200/80 bg-white px-3 py-2 lg:px-6 lg:py-0">
        <motion.div
          {...headerItem(0)}
          className="flex items-center gap-2 lg:gap-3"
        >
          <span className="truncate font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-900">
            {tenant?.name ?? "Sight"}
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-300 sm:inline">
            /
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-900 sm:inline">
            Dashboard
          </span>
          <LiveIndicator />
        </motion.div>

        <motion.div
          {...headerItem(0.08)}
          className="flex items-center gap-1.5 lg:gap-5"
        >
          <LiquidityScore />
          <button
            type="button"
            onClick={() => openCommandPalette(true)}
            aria-label="Open command palette"
            className="flex items-center gap-2 rounded-md border border-zinc-200/80 bg-white px-2.5 py-1.5 text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-700"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={1.6} />
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.1em] sm:inline">
              Search
            </span>
            <kbd className="ml-2 hidden rounded border border-zinc-200 px-1 font-mono text-[9px] text-zinc-500 sm:inline">
              ⌘K
            </kbd>
          </button>
          {/* Actions dropdown: Optimize, FX Hedge, New Transfer. Keeps the
              header to ≤4 visible buttons without losing functionality. */}
          <HeaderActionsMenu
            onSelect={(id) => {
              if (id === "newAccount") setAddAccountOpen(true);
              else if (id === "optimize") setOptimizerOpen(true);
              else if (id === "fxHedge") setHedgeOpen(true);
              else if (id === "newTransfer") setNewTransferOpen(true);
            }}
          />
          {/* Crisis scenarios are scripted against NovaPay account ids —
              only show for the public demo tenant. */}
          {isDemoTenant && (
            <button
              type="button"
              onClick={() => setCrisisModeOpen(!crisisModeOpen)}
              aria-label="Crisis Mode"
              title="Crisis Mode — stress scenarios"
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200/80 bg-white px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900"
            >
              <Siren className="h-3 w-3" strokeWidth={1.7} />
              <span className="hidden md:inline">Crisis</span>
              {activeScenarios.length > 0 && (
                <span className="rounded bg-red-50 px-1 font-mono text-[9px] text-red-700">
                  {activeScenarios.length}
                </span>
              )}
            </button>
          )}
          {/* Auto-tour script references NovaPay-specific accounts (JPMorgan,
              SVB cascade, etc.) — hidden for tenant-owned workspaces. */}
          {isDemoTenant && (
            <div className="hidden lg:block">
              <AutoTourButton />
            </div>
          )}
          {/* Reset wipes the demo into a fresh state — only relevant for the
              shared demo tenant. */}
          {isDemoTenant && (
            <button
              type="button"
              onClick={handleResetDemo}
              aria-label="Reset demo"
              title="Reset to seed state"
              className="hidden h-8 w-8 items-center justify-center rounded-md border border-zinc-200/80 bg-white text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-900 md:inline-flex"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.6} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200/80 bg-white px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900 lg:hidden"
          >
            <SettingsIcon className="h-3 w-3" strokeWidth={1.7} />
          </button>
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-7 w-7",
                userButtonTrigger:
                  "rounded-full focus:outline-none focus:ring-2 focus:ring-zinc-900",
              },
            }}
          />
        </motion.div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:p-4">
        <CounterpartyBanner />
        <CompassBanner />
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[300px_minmax(0,1fr)_360px] lg:gap-4">
          <motion.div
            {...panel(0.18)}
            className="relative flex min-h-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200/80 bg-gradient-to-br from-zinc-50 via-white to-zinc-50 lg:order-2"
          >
            {/* Subtle sphere glow behind the globe — sells the "this is a
                3D ball, not a black square" read after the vignette mask. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-0"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, rgba(37,99,235,0.06) 0%, rgba(37,99,235,0.02) 35%, transparent 60%)",
              }}
            />
            <div className="absolute left-3 top-3 z-10 lg:left-4 lg:top-4">
              <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400 lg:text-[10px]">
                Live Network
              </div>
              <div className="mt-1 text-[12px] font-medium text-zinc-900 lg:text-[13px]">
                {tenant?.name ?? "Treasury"} map
              </div>
            </div>
            <div className="absolute right-3 top-3 z-10 hidden flex-col items-end gap-1.5 sm:flex lg:right-4 lg:top-4">
              <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
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
              {/* Connections toggle below the legend — keeps it visually
                  grouped with other globe controls without blocking arrival/
                  drag-hint footer text. */}
              {connectionWeb.edges.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConnectionsVisible((v) => !v)}
                  aria-pressed={connectionsVisible}
                  title={
                    connectionsVisible
                      ? "Hide connection web"
                      : `Show connection web (${connectionWeb.edges.length} edges)`
                  }
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] backdrop-blur-md transition-colors ${
                    connectionsVisible
                      ? "border-blue-400 bg-blue-50/80 text-blue-700"
                      : "border-zinc-200/80 bg-white/80 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
                  }`}
                >
                  <Network className="h-3 w-3" strokeWidth={1.8} />
                  <span className="hidden md:inline">Connections</span>
                  <span className="rounded bg-white/60 px-1 text-[9px]">
                    {connectionWeb.edges.length}
                  </span>
                </button>
              )}
            </div>
            <div
              className="aspect-square h-auto max-h-[70vh] w-full max-w-full lg:h-full lg:w-auto"
              style={{
                // Soft radial vignette — the orthographic projection fills the
                // square with ocean once you zoom in, so we round the corners
                // back into a sphere visually with a mask + glow.
                maskImage:
                  "radial-gradient(circle at 50% 50%, black 62%, transparent 95%)",
                WebkitMaskImage:
                  "radial-gradient(circle at 50% 50%, black 62%, transparent 95%)",
              }}
            >
              <SightGlobe
                ref={globeRef}
                markers={markers}
                arcs={arcs}
                connectionEdges={connectionWeb.edges}
                connectionMaxAmount={connectionWeb.maxAmount}
                connectionsVisible={connectionsVisible}
                connectionFocusAccountId={hoveredAccountId}
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
            <div className="absolute bottom-3 left-3 z-10 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-400 lg:bottom-4 lg:left-4 lg:text-[10px]">
              {markers.length} accounts · {arcs.length} flows
              {totalAnomalyCount > 0 && (
                <span className="ml-1" title="IsolationForest anomalies detected in last 90 days">
                  · {totalAnomalyCount} anomalies
                </span>
              )}
            </div>
            <div className="absolute bottom-3 right-3 z-10 hidden font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 sm:block lg:bottom-4 lg:right-4">
              Drag · Scroll · 0 to reset
            </div>
          </motion.div>

          <motion.div
            {...panel(0.14)}
            className="flex min-h-0 flex-col gap-3 overflow-y-auto lg:order-3"
          >
            <ConcentrationCard />
            <ActivityPanel />
            <div className="min-h-[260px] flex-1 overflow-hidden rounded-xl border border-zinc-200/80 bg-white/60 p-3 lg:p-4">
              <AlertsPanel />
            </div>
          </motion.div>

          <motion.div
            {...panel(0.1)}
            className="min-h-0 overflow-y-auto rounded-xl border border-zinc-200/80 bg-white/60 p-3 lg:order-1 lg:p-4"
          >
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              Accounts · {accounts.length}
            </div>
            {!hydrated ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-[78px] animate-pulse rounded-lg border border-zinc-200/60 bg-zinc-100/60"
                  />
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-200 px-4 py-8 text-center">
                <p className="text-[13px] font-medium text-zinc-700">
                  No accounts yet
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">
                  Add your first bank account to start forecasting cash flow and
                  monitoring concentration risk.
                </p>
                <button
                  type="button"
                  onClick={() => setAddAccountOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white transition-colors hover:bg-zinc-800"
                >
                  Add account
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {accounts.map((a) => (
                  <AccountCard key={a.id} account={a} />
                ))}
              </div>
            )}
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
      <SettingsPanel />
      <AiChatPanel />
      <MobileFallback />
      <NewTransferModal
        open={newTransferOpen}
        onClose={() => setNewTransferOpen(false)}
      />
      <OptimizerPanel
        open={optimizerOpen}
        onClose={() => setOptimizerOpen(false)}
      />
      <FxHedgePanel open={hedgeOpen} onClose={() => setHedgeOpen(false)} />
      <AddAccountPanel
        open={addAccountOpen}
        onClose={() => setAddAccountOpen(false)}
      />
      <FloatingCopilotButton />
    </div>
  );
}
