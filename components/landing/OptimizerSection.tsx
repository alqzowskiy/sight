"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowDown, ArrowRight, Droplet, Sparkles } from "lucide-react";
import Link from "next/link";
import { computeLiquidityGradientPlan } from "@/lib/optimizer/gradient";
import { accountMetas, buildAccountsFromMeta } from "@/lib/data/accounts";
import { formatCompact } from "@/lib/utils/format";

const ease = [0.16, 1, 0.3, 1] as const;

function shortName(fullName: string): string {
  return fullName
    .replace(/^NovaPay\s+/, "")
    .replace(/^Regulatory\s+/, "Reg. ");
}

function nameFor(id: string): string {
  const meta = accountMetas.find((a) => a.id === id);
  return meta ? shortName(meta.name) : id;
}

interface ComputedData {
  topPressures: Array<{
    accountId: string;
    label: string;
    pressure: number;
    pressurePct: number;
    dayHit: string;
  }>;
  planSteps: Array<{
    from: string;
    to: string;
    amount: string;
    channel: string;
    reason: string;
  }>;
  pressureBars: Array<{
    id: string;
    label: string;
    before: number;
    after: number;
  }>;
  summary: {
    transfers: number;
    feesUsd: number;
    deficits: number;
    iterations: number;
    runtimeMs: number;
  };
}

// Placeholder shown during SSR. The real plan depends on `new Date()` via
// forecast indexing, so it has to be computed on the client to avoid a
// hydration mismatch (server's "today" ≠ client's "today" when iterations
// land on a different forecast window).
const PLACEHOLDER: ComputedData = {
  topPressures: [],
  planSteps: [],
  pressureBars: [],
  summary: { transfers: 0, feesUsd: 0, deficits: 0, iterations: 0, runtimeMs: 0 },
};

function useComputedPlan(): ComputedData {
  const [data, setData] = useState<ComputedData>(PLACEHOLDER);
  useEffect(() => {
    setData(computePlan());
  }, []);
  return data;
}

function computePlan(): ComputedData {
  const accounts = buildAccountsFromMeta();
    const start = performance.now();
    const plan = computeLiquidityGradientPlan(accounts);
    const runtimeMs = Math.max(1, Math.round(performance.now() - start));

    const maxPressureRaw = Math.max(
      1,
      ...plan.pressuresBefore.map((p) => p.pressure),
    );
    const topPressures = [...plan.pressuresBefore]
      .filter((p) => p.pressure > 0)
      .sort((a, b) => b.pressure - a.pressure)
      .slice(0, 4)
      .map((p) => ({
        accountId: p.accountId,
        label: nameFor(p.accountId),
        pressure: Math.round(p.pressure),
        pressurePct: Math.min(100, (p.pressure / maxPressureRaw) * 100),
        dayHit:
          p.worstDayOffset === 0
            ? "today"
            : p.worstDayOffset > 0
              ? `+${p.worstDayOffset}d`
              : `${p.worstDayOffset}d`,
      }));

    const planSteps = plan.steps.slice(0, 4).map((s) => {
      const sent = formatCompact(s.amount, s.currency);
      const amount = s.fxApplied
        ? `${sent} → ${formatCompact(s.receivedAmount, s.receivedCurrency)}`
        : sent;
      const channel = s.fxApplied ? `${s.channel} + FX` : s.channel;
      return {
        from: nameFor(s.from),
        to: nameFor(s.to),
        amount,
        channel,
        reason: s.reason,
      };
    });

    const rankedForBars = [...plan.pressuresBefore]
      .sort((a, b) => b.pressure - a.pressure)
      .slice(0, 5);
    const pressureBars = rankedForBars.map((p) => {
      const after = plan.pressuresAfter.find(
        (x) => x.accountId === p.accountId,
      );
      return {
        id: p.accountId,
        label: nameFor(p.accountId),
        before: Math.round((p.pressure / maxPressureRaw) * 100),
        after: Math.round(((after?.pressure ?? 0) / maxPressureRaw) * 100),
      };
    });

    return {
      topPressures,
      planSteps,
      pressureBars,
      summary: {
        transfers: plan.steps.length,
        feesUsd: Math.round(plan.totalFees),
        deficits: plan.afterDeficitDays,
        iterations: plan.iterations,
        runtimeMs,
      },
    };
}

export function OptimizerSection() {
  const { topPressures, planSteps, pressureBars, summary } = useComputedPlan();
  const summaryText = `${summary.transfers} transfers · $${summary.feesUsd.toLocaleString("en-US")} fees · ${summary.deficits} deficits`;

  return (
    <section
      id="optimizer"
      className="border-t border-zinc-200/80 bg-white px-6 py-24 md:px-10 lg:px-16"
    >
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-12 flex items-baseline justify-between gap-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              Beyond prediction · Allocation
            </div>
            <h2 className="mt-2 max-w-[680px] text-[34px] font-medium leading-[1.05] tracking-[-0.02em] text-zinc-900 md:text-[44px]">
              Predicts shortfalls. Then solves them in one click.
            </h2>
          </div>
          <p className="hidden max-w-[320px] text-[13px] leading-relaxed text-zinc-500 md:block">
            A liquidity-gradient algorithm routes funds from low-pressure
            surplus accounts to high-pressure deficit accounts, in the right
            currency, through the cheapest channel.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.4fr]">
          {/* Left: pressure model */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, ease }}
            className="flex flex-col rounded-xl border border-zinc-200 bg-zinc-950 p-5 text-zinc-100"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                pressure model · live
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-sky-300">
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inset-0 animate-ping rounded-full bg-sky-400 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-400" />
                </span>
                Gradient
              </span>
            </div>

            <div className="rounded-lg bg-zinc-900/60 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
              <div className="text-zinc-500"># urgency-weighted deficit</div>
              <div className="mt-1">
                <span className="text-sky-300">pressure</span>(a) ={" "}
                <span className="text-zinc-400">Σ</span>
                <sub className="text-zinc-500">d∈[0,14]</sub>{" "}
                max(0, min<sub className="text-zinc-500">a</sub> − bal
                <sub className="text-zinc-500">a,d</sub>)
                <span className="text-zinc-500"> · </span>
                w<sub className="text-zinc-500">d</sub>
              </div>
              <div className="mt-2 text-zinc-500"># supply &amp; flow</div>
              <div className="mt-1">
                <span className="text-emerald-300">supply</span>(a) = min<sub className="text-zinc-500">d</sub>
                (bal<sub className="text-zinc-500">a,d</sub> − min
                <sub className="text-zinc-500">a</sub>)
              </div>
              <div className="mt-2 text-zinc-400">flow: argmax(pressure) ← argmax(supply)</div>
            </div>

            <div className="mt-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                Computed pressure · top {topPressures.length}
              </div>
              <div className="space-y-2">
                {topPressures.map((p, i) => (
                  <PressureRow
                    key={p.accountId}
                    label={p.label}
                    pressure={p.pressure}
                    pressurePct={p.pressurePct}
                    hit={p.dayHit}
                    delay={0.15 + i * 0.08}
                  />
                ))}
                {topPressures.length === 0 && (
                  <div className="font-mono text-[11px] text-emerald-300">
                    no accounts under pressure · system in equilibrium
                  </div>
                )}
              </div>
            </div>

            <div className="mt-auto pt-5">
              <div className="rounded-lg bg-zinc-900/60 p-3 font-mono text-[10px] leading-relaxed text-zinc-300">
                <span className="text-zinc-500">iter:</span> {summary.iterations} / 40
                <br />
                <span className="text-zinc-500">converged at:</span>{" "}
                {summary.transfers} transfers
                <br />
                <span className="text-zinc-500">runtime:</span>{" "}
                {summary.runtimeMs}ms
              </div>
              <div className="mt-4 flex items-center justify-center text-zinc-700">
                <ArrowDown className="h-4 w-4" />
              </div>
            </div>
          </motion.div>

          {/* Right: pressure map + plan */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, delay: 0.1, ease }}
            className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white">
                <Droplet className="h-2.5 w-2.5" />
                Optimizer
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-400">
                {summaryText}
              </span>
            </div>

            <div className="mb-5">
              <div className="mb-2 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                <span>Pressure map</span>
                <span className="text-zinc-400">before · after</span>
              </div>
              <div className="space-y-2">
                {pressureBars.map((b, i) => (
                  <PressureBar
                    key={b.id}
                    label={b.label}
                    before={b.before}
                    after={b.after}
                    delay={0.25 + i * 0.07}
                  />
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                Computed plan · execute top-down
              </div>
              {planSteps.length === 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-[12px] text-emerald-700">
                  No rebalancing needed — all accounts above minimum for the
                  next 14 days.
                </div>
              ) : (
                <ol className="space-y-1.5">
                  {planSteps.map((s, i) => (
                    <PlanRow
                      key={i}
                      idx={i + 1}
                      from={s.from}
                      to={s.to}
                      amount={s.amount}
                      channel={s.channel}
                      reason={s.reason}
                      delay={0.5 + i * 0.08}
                    />
                  ))}
                </ol>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                One click compresses ~6h of treasury work
              </span>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white transition-colors hover:bg-zinc-800"
              >
                <Sparkles className="h-3 w-3" />
                Run in demo
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function PressureRow({
  label,
  pressure,
  pressurePct,
  hit,
  delay,
}: {
  label: string;
  pressure: number;
  pressurePct: number;
  hit: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay, ease }}
      className="grid grid-cols-[110px_1fr_auto] items-center gap-3 font-mono text-[11px]"
    >
      <span className="truncate text-zinc-300">{label}</span>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${pressurePct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: delay + 0.05, ease }}
          className="absolute inset-y-0 left-0 rounded-full bg-rose-400"
        />
      </div>
      <span className="tabular-nums text-zinc-400">
        {hit} · {pressure.toLocaleString("en-US")}
      </span>
    </motion.div>
  );
}

function PressureBar({
  label,
  before,
  after,
  delay,
}: {
  label: string;
  before: number;
  after: number;
  delay: number;
}) {
  return (
    <div className="text-[11px]">
      <div className="flex items-baseline justify-between gap-2 font-mono">
        <span className="text-zinc-700">{label}</span>
        <span className="tabular-nums text-zinc-400">
          <span className="text-rose-500">{before}</span> →{" "}
          <span className="text-zinc-900">{after}</span>
        </span>
      </div>
      <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-zinc-100">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${before}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay, ease }}
          className="h-full bg-rose-400"
        />
      </div>
      <div className="mt-0.5 h-[5px] overflow-hidden rounded-full bg-zinc-100">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${after}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: delay + 0.15, ease }}
          className="h-full"
          style={{ background: "#2563EB" }}
        />
      </div>
    </div>
  );
}

function PlanRow({
  idx,
  from,
  to,
  amount,
  channel,
  reason,
  delay,
}: {
  idx: number;
  from: string;
  to: string;
  amount: string;
  channel: string;
  reason: string;
  delay: number;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay, ease }}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-zinc-100 px-3 py-2"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-200 font-mono text-[9px] tabular-nums text-zinc-500">
        {idx}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-900">
          <span className="truncate">{from}</span>
          <ArrowRight className="h-3 w-3 shrink-0 text-zinc-400" strokeWidth={2} />
          <span className="truncate">{to}</span>
        </div>
        <div className="mt-0.5 text-[10px] text-zinc-500">{reason}</div>
      </div>
      <div className="text-right">
        <div className="font-mono text-[12px] tabular-nums text-zinc-900">
          {amount}
        </div>
        <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400">
          {channel}
        </div>
      </div>
    </motion.li>
  );
}
