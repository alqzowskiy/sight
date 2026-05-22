"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, ShieldAlert } from "lucide-react";
import { useCrisisStore } from "@/lib/store/crisis-store";
import { useAccountsStore } from "@/lib/store/accounts-store";
import { useTimeStore } from "@/lib/store/time-store";
import { crisisScenarios } from "@/lib/data/crisis-scenarios";
import { crisisImpact } from "@/lib/utils/scoring";

const ease = [0.16, 1, 0.3, 1] as const;
const COUNTERPARTY_ID = "counterparty-default";

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

  const staticScenarios = crisisScenarios.filter(
    (s) => !s.requiresConfig,
  );
  const counterparty = crisisScenarios.find((s) => s.id === COUNTERPARTY_ID);

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
            className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[380px] flex-col border-l border-zinc-200 bg-white shadow-xl"
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
              {counterparty && <CounterpartyCard />}
              {staticScenarios.map((s) => {
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

function CounterpartyCard() {
  const accounts = useAccountsStore((s) => s.accounts);
  const active = useCrisisStore((s) => s.activeScenarios);
  const config = useCrisisStore((s) => s.counterpartyConfig);
  const activate = useCrisisStore((s) => s.activateCounterparty);
  const toggle = useCrisisStore((s) => s.toggleScenario);
  const setConfig = useCrisisStore((s) => s.setCounterpartyConfig);

  const isOn = active.includes(COUNTERPARTY_ID);
  const [recoveryDays, setRecoveryDays] = useState(config?.recoveryDays ?? 7);

  // Banks grouped with their total exposed balance to give context to the user.
  const banks = useMemo(() => {
    const totals = new Map<string, { balance: number; accounts: number }>();
    for (const a of accounts) {
      const prev = totals.get(a.bank) ?? { balance: 0, accounts: 0 };
      totals.set(a.bank, {
        balance: prev.balance + a.balance,
        accounts: prev.accounts + 1,
      });
    }
    return [...totals.entries()]
      .map(([bank, t]) => ({ bank, ...t }))
      .sort((a, b) => b.balance - a.balance);
  }, [accounts]);

  const [selectedBank, setSelectedBank] = useState<string | null>(
    config?.bank ?? null,
  );

  function handleActivate() {
    if (!selectedBank) return;
    const total = banks.find((b) => b.bank === selectedBank);
    activate({
      bank: selectedBank,
      recoveryDays,
      label: total
        ? `${selectedBank} (${total.accounts} accounts, ${(total.balance / 1_000_000).toFixed(1)}M frozen)`
        : selectedBank,
    });
  }

  function handleDeactivate() {
    toggle(COUNTERPARTY_ID);
    setConfig(null);
    setSelectedBank(null);
  }

  return (
    <div
      className={`rounded-lg border bg-white p-3 transition-colors ${
        isOn ? "border-red-400 bg-red-50/40" : "border-zinc-200/80"
      }`}
    >
      <div className="flex items-start gap-2">
        <ShieldAlert
          className={`mt-0.5 h-4 w-4 shrink-0 ${
            isOn ? "text-red-600" : "text-zinc-500"
          }`}
          strokeWidth={1.8}
        />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-900">
            Counterparty Default
          </div>
          <p className="mt-1 text-[12px] leading-snug text-zinc-500">
            Pick a bank that goes into default. Echoes the SVB-2023 cascade.
          </p>
        </div>
      </div>

      {isOn && config ? (
        <div className="mt-3 rounded-md border border-red-200 bg-white px-3 py-2 text-[11px]">
          <div className="font-mono uppercase tracking-[0.1em] text-red-700">
            Active
          </div>
          <div className="mt-1 text-zinc-700">{config.label ?? config.bank}</div>
          <div className="mt-1 font-mono text-[10px] text-zinc-500">
            Recovery in {config.recoveryDays}d
          </div>
          <button
            type="button"
            onClick={handleDeactivate}
            className="mt-2 w-full rounded border border-zinc-200 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Deactivate
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="space-y-1">
            <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">
              Failing counterparty
            </div>
            <div className="grid grid-cols-1 gap-1">
              {banks.map((b) => (
                <button
                  key={b.bank}
                  type="button"
                  onClick={() => setSelectedBank(b.bank)}
                  className={`flex items-center justify-between rounded border px-2 py-1.5 text-left transition-colors ${
                    selectedBank === b.bank
                      ? "border-red-300 bg-red-50/60"
                      : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <span className="text-[11px] text-zinc-900">{b.bank}</span>
                  <span className="font-mono text-[10px] tabular-nums text-zinc-500">
                    {b.accounts}× · ${(b.balance / 1_000_000).toFixed(1)}M
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">
              <span>Recovery</span>
              <span className="tabular-nums text-zinc-700">
                {recoveryDays}d
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              value={recoveryDays}
              onChange={(e) => setRecoveryDays(parseInt(e.target.value, 10))}
              className="mt-1 w-full accent-red-600"
            />
          </div>

          <button
            type="button"
            onClick={handleActivate}
            disabled={!selectedBank}
            className="w-full rounded-md border border-red-300 bg-red-600 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            {selectedBank ? `Trigger Default · ${selectedBank}` : "Pick a bank"}
          </button>
        </div>
      )}
    </div>
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
