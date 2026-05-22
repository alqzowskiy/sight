"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  X,
  Shield,
  ArrowDownRight,
  Eye,
  AlertCircle,
  Loader2,
} from "lucide-react";
import type {
  FxHedgePlan,
  FxHedgeRecommendation,
  HedgeAction,
} from "@/lib/utils/fx-hedge";
import { formatCompact } from "@/lib/utils/format";

const ease = [0.16, 1, 0.3, 1] as const;

const ACTION_STYLES: Record<
  HedgeAction,
  { label: string; tone: string; bg: string }
> = {
  hedge: {
    label: "Hedge",
    tone: "text-red-700 border-red-200",
    bg: "bg-red-50",
  },
  monitor: {
    label: "Monitor",
    tone: "text-amber-700 border-amber-200",
    bg: "bg-amber-50",
  },
  "no-action": {
    label: "OK",
    tone: "text-emerald-700 border-emerald-200",
    bg: "bg-emerald-50",
  },
};

const ACTION_ICONS: Record<HedgeAction, typeof Shield> = {
  hedge: ArrowDownRight,
  monitor: Eye,
  "no-action": Shield,
};

export function FxHedgePanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [plan, setPlan] = useState<FxHedgePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/v1/fx-hedge", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data: FxHedgePlan) => {
        if (!cancelled) setPlan(data);
      })
      .catch((e) => {
        if (!cancelled) setError(typeof e === "string" ? e : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-zinc-900/30 backdrop-blur-[2px]"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.35, ease }}
            className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[560px] flex-col border-l border-zinc-200 bg-white shadow-xl"
          >
            <Header onClose={onClose} />
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                </div>
              )}
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                  {error}
                </div>
              )}
              {plan && !loading && (
                <>
                  <SummaryStrip plan={plan} />
                  <ExplainStrip />
                  <div className="mt-5 space-y-2">
                    {plan.recommendations.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-zinc-200 px-4 py-8 text-center text-[13px] text-zinc-500">
                        No FX positions to hedge. Add non-USD accounts to enable
                        hedge recommendations.
                      </div>
                    ) : (
                      plan.recommendations.map((r) => (
                        <RecommendationRow key={r.accountId} rec={r} />
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
            <Footer />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <header className="flex items-start justify-between border-b border-zinc-200/80 px-6 py-5">
      <div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
          <Shield className="h-3 w-3" strokeWidth={2} />
          Sight Hedge Advisor
        </div>
        <h2 className="mt-1 text-[18px] font-medium tracking-tight text-zinc-950">
          FX hedge optimizer
        </h2>
        <p className="mt-1 max-w-[420px] text-[12px] leading-relaxed text-zinc-500">
          Minimum-variance hedge ratios for every non-USD position, sized to
          keep 1-month 95% VaR inside a 3% buffer.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
      >
        <X className="h-4 w-4" />
      </button>
    </header>
  );
}

function SummaryStrip({ plan }: { plan: FxHedgePlan }) {
  const s = plan.summary;
  const varReduction =
    s.totalUnhedgedVar1mUsd === 0
      ? 0
      : 1 - s.totalResidualVar1mUsd / s.totalUnhedgedVar1mUsd;
  return (
    <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 md:grid-cols-4">
      <Metric
        label="Exposure"
        value={formatCompact(s.totalExposureUsd, "USD")}
        sub="Non-USD positions"
      />
      <Metric
        label="VaR unhedged"
        value={formatCompact(s.totalUnhedgedVar1mUsd, "USD")}
        sub="1m · 95%"
      />
      <Metric
        label="VaR with hedge"
        value={formatCompact(s.totalResidualVar1mUsd, "USD")}
        sub={`${Math.round(varReduction * 100)}% reduced`}
        tone={s.hedgesRecommended > 0 ? "emerald" : undefined}
      />
      <Metric
        label="Annual cost"
        value={formatCompact(s.totalAnnualCostUsd, "USD")}
        sub={`${s.hedgesRecommended} hedges`}
        tone="amber"
      />
    </div>
  );
}

function ExplainStrip() {
  return (
    <div className="mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] leading-relaxed text-zinc-600">
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">
        How
      </span>
      <span className="ml-2">
        h* = ρ × σ_pos / σ_hedge, sized so residual 1m VaR ≤ 3% of position.
        Volatility from spot history, hedge costs include forward points + bid/ask.
        Indicative — production would source from Refinitiv or Bloomberg.
      </span>
    </div>
  );
}

function RecommendationRow({ rec }: { rec: FxHedgeRecommendation }) {
  const style = ACTION_STYLES[rec.action];
  const Icon = ACTION_ICONS[rec.action];
  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        rec.action === "hedge"
          ? "border-red-200/80 bg-red-50/30"
          : "border-zinc-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${style.tone} ${style.bg}`}
            >
              <Icon className="h-2.5 w-2.5" strokeWidth={2} />
              {style.label}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-500">
              {rec.currency}
            </span>
          </div>
          <div className="mt-1.5 text-[13px] font-medium text-zinc-950">
            {rec.accountName}
          </div>
          <div className="font-mono text-[10px] text-zinc-500">{rec.bank}</div>
        </div>

        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
            Position
          </div>
          <div className="font-mono text-[14px] tabular-nums text-zinc-900">
            {formatCompact(rec.positionUsd, "USD")}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-zinc-50/80 p-2">
        <Mini
          label="Hedge ratio"
          value={`${Math.round(rec.hedgeRatio * 100)}%`}
        />
        <Mini
          label="Notional"
          value={formatCompact(rec.hedgeNotionalUsd, "USD")}
        />
        <Mini
          label="Annual cost"
          value={formatCompact(rec.annualCostUsd, "USD")}
        />
      </div>

      <p className="mt-2 text-[12px] leading-snug text-zinc-700">
        {rec.reason}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "emerald" | "amber";
}) {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : "text-zinc-950";
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </div>
      <div className={`mt-0.5 font-mono text-[15px] tabular-nums ${toneCls}`}>
        {value}
      </div>
      {sub && (
        <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-400">
          {sub}
        </div>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-500">
        {label}
      </div>
      <div className="font-mono text-[12px] tabular-nums text-zinc-900">
        {value}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="flex items-start gap-2 border-t border-zinc-200/80 px-6 py-4">
      <AlertCircle
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400"
        strokeWidth={1.8}
      />
      <p className="text-[11px] leading-relaxed text-zinc-500">
        Sight is Co-pilot, not Autopilot. These are recommendations — Sight
        does not execute forwards or place market orders. Use your bank or
        FX provider to enter actual hedges.
      </p>
    </footer>
  );
}
