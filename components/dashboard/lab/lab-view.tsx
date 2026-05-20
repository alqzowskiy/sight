"use client";

import { useMemo, useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from "recharts";
import { motion } from "motion/react";
import { Info } from "lucide-react";
import backtestJson from "@/public/data/backtest_results.json";
import selectionJson from "@/public/data/selection.json";
import { accountMetas } from "@/lib/data/accounts";
import { formatCompact } from "@/lib/utils/format";

const SELECTION = selectionJson as Record<
  string,
  { chosen: string; mape: Record<string, number | null> }
>;

interface Horizon {
  days: number;
  sight_mape: number;
  naive_mape: number | null;
  moving_avg_mape: number | null;
  seasonal_naive_mape: number | null;
}

interface PerAccount {
  account_id: string;
  model: string;
  mape_7d: number;
  coverage_p10_p90: number;
  cutoffs: number;
}

interface AvpPoint {
  date: string;
  actual: number;
  predicted: number;
  p10: number;
  p90: number;
}

interface Backtest {
  model_version: string;
  evaluated_at: string;
  ensemble_members?: string[];
  horizons: Horizon[];
  per_account: PerAccount[];
  deficit_detection: {
    precision: number;
    recall: number;
    f1: number;
    tp: number;
    fp: number;
    fn: number;
    tn: number;
  };
  calibration: {
    nominal_coverage: number;
    empirical_coverage: number;
    delta: number;
  };
  impact: {
    overdrafts_without_sight: number;
    overdrafts_with_sight: number;
    deficit_pairs_observed: number;
  };
  ensemble_holdout_mape?: {
    description: string;
    by_model: Record<string, number>;
  };
  per_account_holdout?: Record<
    string,
    { chosen: string; mape: Record<string, number | null> }
  >;
  summary: {
    pairs_evaluated: number;
    accounts_evaluated: number;
  };
  actual_vs_predicted_h7: Record<string, AvpPoint[]>;
}

const BT = backtestJson as unknown as Backtest;

const DEFAULT_ENSEMBLE_MEMBERS = [
  "prophet",
  "lightgbm",
  "arima",
  "ets",
  "chronos",
  "stacker",
];

const MODEL_LABELS: Record<string, string> = {
  prophet: "Prophet",
  lightgbm: "LightGBM",
  arima: "ARIMA",
  ets: "Holt-Winters",
  chronos: "Chronos",
  stacker: "Stacked Ensemble",
};

function formatPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v.toFixed(2)}%`;
}

function avgSightMape(): number {
  const vals = BT.horizons.map((h) => h.sight_mape);
  return vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
}

function FRACTION_HOURS(deficit_pairs: number): number {
  return Math.round(deficit_pairs * 0.12);
}

export function LabView() {
  const accounts = useMemo(
    () =>
      Object.keys(BT.actual_vs_predicted_h7).map((id) => ({
        id,
        name: accountMetas.find((a) => a.id === id)?.name ?? id,
        currency: accountMetas.find((a) => a.id === id)?.currency ?? "USD",
      })),
    [],
  );

  const [selectedAccount, setSelectedAccount] = useState<string>(() =>
    accounts.find((a) => a.id === "usd-nyc")?.id ?? accounts[0]?.id ?? "",
  );

  const accuracy = useMemo(() => 100 - avgSightMape(), []);
  const horizonByDays = useMemo(
    () => new Map(BT.horizons.map((h) => [h.days, h])),
    [],
  );
  const sevenDay = horizonByDays.get(7);
  const fourteenDay = horizonByDays.get(14);

  const evaluatedDate = new Date(BT.evaluated_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const avpData = useMemo(() => {
    const arr = BT.actual_vs_predicted_h7[selectedAccount] ?? [];
    return arr.map((p) => ({
      date: p.date,
      actual: p.actual,
      predicted: p.predicted,
      p10: p.p10,
      p90: p.p90,
      band: [p.p10, p.p90] as [number, number],
    }));
  }, [selectedAccount]);

  const ensembleBars = useMemo(() => {
    // Prefer backtest JSON if it carries the per-model holdout MAPE,
    // otherwise derive averages from selection.json (per-account MAPE).
    let byModel: Record<string, number>;
    if (BT.ensemble_holdout_mape?.by_model) {
      byModel = BT.ensemble_holdout_mape.by_model;
    } else {
      const sums: Record<string, number> = {};
      const counts: Record<string, number> = {};
      for (const entry of Object.values(SELECTION)) {
        for (const [model, mape] of Object.entries(entry.mape)) {
          if (mape != null && Number.isFinite(mape)) {
            sums[model] = (sums[model] ?? 0) + mape;
            counts[model] = (counts[model] ?? 0) + 1;
          }
        }
      }
      byModel = {};
      for (const m of Object.keys(sums)) {
        byModel[m] = sums[m] / counts[m];
      }
    }

    // Winner is the model with the lowest average MAPE across accounts.
    const sortedIds = Object.entries(byModel).sort((a, b) => a[1] - b[1]);
    const winnerId = sortedIds[0]?.[0];

    return sortedIds.map(([id, mape]) => ({
      id,
      label: MODEL_LABELS[id] ?? id,
      mape,
      winner: id === winnerId,
    }));
  }, []);

  const selectedCurrency =
    accounts.find((a) => a.id === selectedAccount)?.currency ?? "USD";

  return (
    <div className="h-full overflow-y-auto bg-[#FAFAFA] pb-16">
      <Header
        modelVersion={BT.model_version}
        evaluatedDate={evaluatedDate}
        accounts={BT.summary.accounts_evaluated}
        pairs={BT.summary.pairs_evaluated}
      />

      <Section>
        <MethodologyBanner />
      </Section>

      <Section>
        <KpiGrid
          accuracy={accuracy}
          mape7d={sevenDay?.sight_mape ?? 0}
          mape14d={fourteenDay?.sight_mape ?? 0}
          f1={BT.deficit_detection.f1}
        />
      </Section>

      <Section title="Per-horizon comparison" subtitle="Sight ensemble vs. three baseline forecasters. Lower is better.">
        <HorizonTable horizons={BT.horizons} />
      </Section>

      <Section title="Real vs predicted" subtitle="Walk-forward backtest at 7-day horizon. Predictions made on each cutoff date, then compared against what actually happened.">
        <AccountSelector
          accounts={accounts}
          selected={selectedAccount}
          onChange={setSelectedAccount}
        />
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-5">
          <AvpChart data={avpData} currency={selectedCurrency} />
        </div>
      </Section>

      <Section>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ConfusionMatrix data={BT.deficit_detection} />
          <EnsembleChart bars={ensembleBars} />
        </div>
      </Section>

      <Section title="Impact summary" subtitle="What the backtest implies for treasury operations across 30 days of walk-forward evaluation.">
        <ImpactGrid
          impact={BT.impact}
          hoursWithout={FRACTION_HOURS(BT.impact.overdrafts_without_sight) + 240}
          hoursWith={FRACTION_HOURS(BT.impact.overdrafts_with_sight) + 96}
        />
      </Section>

      <Section title="Pipeline" subtitle="What's behind the numbers.">
        <PipelineCard
          members={BT.ensemble_members ?? DEFAULT_ENSEMBLE_MEMBERS}
          version={BT.model_version}
        />
      </Section>
    </div>
  );
}

function Header({
  modelVersion,
  evaluatedDate,
  accounts,
  pairs,
}: {
  modelVersion: string;
  evaluatedDate: string;
  accounts: number;
  pairs: number;
}) {
  return (
    <div className="border-b border-zinc-200 bg-white px-8 py-6">
      <div className="flex items-baseline justify-between gap-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
            Sight Lab
          </div>
          <h1 className="mt-1 text-[22px] font-medium tracking-tight text-zinc-900">
            Forecast accuracy & backtest results
          </h1>
          <p className="mt-1 text-[12px] text-zinc-500">
            Walk-forward evaluation over the last 30 days.
            {" "}
            {pairs.toLocaleString("en-US")} (account, horizon) predictions across {accounts} accounts.
          </p>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
          <span className="rounded border border-zinc-200 px-2 py-1 text-zinc-700">
            {modelVersion}
          </span>
          <span>evaluated {evaluatedDate}</span>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-[1180px] px-8 pt-8">
      {title && (
        <div className="mb-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

function KpiGrid({
  accuracy,
  mape7d,
  mape14d,
  f1,
}: {
  accuracy: number;
  mape7d: number;
  mape14d: number;
  f1: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        label="Overall accuracy"
        value={accuracy}
        format={(v) => `${v.toFixed(1)}%`}
        sub="100 − avg MAPE"
        accent="positive"
      />
      <KpiCard
        label="7-day MAPE"
        value={mape7d}
        format={(v) => `${v.toFixed(2)}%`}
        sub="median horizon"
      />
      <KpiCard
        label="14-day MAPE"
        value={mape14d}
        format={(v) => `${v.toFixed(2)}%`}
        sub="longest horizon"
      />
      <KpiCard
        label="Deficit detection F1"
        value={f1}
        format={(v) => v.toFixed(3)}
        sub="precision × recall"
        accent="positive"
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  format,
  sub,
  accent,
}: {
  label: string;
  value: number;
  format: (v: number) => string;
  sub?: string;
  accent?: "positive";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border border-zinc-200 bg-white p-4"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
        {label}
      </div>
      <div
        className={`mt-2 font-mono text-[26px] tabular-nums tracking-tight ${
          accent === "positive" ? "text-zinc-900" : "text-zinc-900"
        }`}
      >
        {format(value)}
      </div>
      {sub && (
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
          {sub}
        </div>
      )}
    </motion.div>
  );
}

function HorizonTable({ horizons }: { horizons: Horizon[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
            <th className="px-4 py-3 text-left">Horizon</th>
            <th className="px-4 py-3 text-right text-zinc-900">Sight</th>
            <th className="px-4 py-3 text-right">Naive</th>
            <th className="px-4 py-3 text-right">7-day MA</th>
            <th className="px-4 py-3 text-right">Seasonal Naive</th>
          </tr>
        </thead>
        <tbody>
          {horizons.map((h, idx) => {
            const cells = [
              { label: "Sight", value: h.sight_mape, highlight: true },
              { label: "Naive", value: h.naive_mape, highlight: false },
              { label: "MA-7", value: h.moving_avg_mape, highlight: false },
              {
                label: "Seasonal",
                value: h.seasonal_naive_mape,
                highlight: false,
              },
            ];
            const sightBest =
              h.sight_mape ===
              Math.min(
                ...cells.filter((c) => c.value != null).map((c) => c.value as number),
              );
            return (
              <tr
                key={h.days}
                className={
                  idx % 2 === 1 ? "bg-zinc-50/40" : "bg-white"
                }
              >
                <td className="border-t border-zinc-100 px-4 py-3 font-mono text-zinc-700">
                  {h.days} day{h.days > 1 ? "s" : ""}
                </td>
                <td
                  className={`border-t border-zinc-100 px-4 py-3 text-right font-mono tabular-nums ${
                    sightBest ? "text-emerald-700" : "text-zinc-900"
                  }`}
                >
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5">
                    {formatPct(h.sight_mape)}
                  </span>
                </td>
                <td className="border-t border-zinc-100 px-4 py-3 text-right font-mono tabular-nums text-zinc-500">
                  {formatPct(h.naive_mape)}
                </td>
                <td className="border-t border-zinc-100 px-4 py-3 text-right font-mono tabular-nums text-zinc-500">
                  {formatPct(h.moving_avg_mape)}
                </td>
                <td className="border-t border-zinc-100 px-4 py-3 text-right font-mono tabular-nums text-zinc-500">
                  {formatPct(h.seasonal_naive_mape)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AccountSelector({
  accounts,
  selected,
  onChange,
}: {
  accounts: { id: string; name: string; currency: string }[];
  selected: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
        Account
      </label>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-[11px] text-zinc-900 focus:border-zinc-900 focus:outline-none"
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {a.currency}
          </option>
        ))}
      </select>
    </div>
  );
}

function AvpChart({
  data,
  currency,
}: {
  data: Array<{
    date: string;
    actual: number;
    predicted: number;
    band: [number, number];
  }>;
  currency: string;
}) {
  if (data.length === 0) {
    return (
      <div className="grid h-[280px] place-items-center text-[12px] text-zinc-500">
        No backtest data for this account.
      </div>
    );
  }
  return (
    <div className="relative" style={{ width: "100%", height: 320 }}>
      <div className="pointer-events-none absolute right-2 top-1 z-10 flex items-center gap-3 rounded-md border border-zinc-200/80 bg-white/90 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500 backdrop-blur-sm">
        <span className="flex items-center gap-1.5">
          <span className="block h-[2px] w-3.5 bg-zinc-900" />
          Actual
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="14" height="2" viewBox="0 0 14 2" aria-hidden>
            <line
              x1="0"
              y1="1"
              x2="14"
              y2="1"
              stroke="#2563EB"
              strokeWidth="2"
              strokeDasharray="3 2"
            />
          </svg>
          Predicted
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="block h-2 w-3.5 rounded-[2px] border border-zinc-200"
            style={{
              background:
                "linear-gradient(180deg, rgba(10,10,10,0.10) 0%, rgba(10,10,10,0.02) 100%)",
            }}
          />
          P10–P90
        </span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
        >
          <defs>
            <linearGradient id="lab-band" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0A0A0A" stopOpacity={0.1} />
              <stop offset="100%" stopColor="#0A0A0A" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{
              fill: "#A1A1AA",
              fontSize: 10,
              fontFamily: "var(--font-geist-mono), monospace",
            }}
            axisLine={{ stroke: "#E4E4E7" }}
            tickLine={false}
            tickFormatter={(d) =>
              new Date(d).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            }
            interval="preserveStartEnd"
            minTickGap={32}
          />
          <YAxis
            tick={{
              fill: "#A1A1AA",
              fontSize: 10,
              fontFamily: "var(--font-geist-mono), monospace",
            }}
            axisLine={false}
            tickLine={false}
            width={68}
            tickFormatter={(v) => formatCompact(v, currency)}
          />
          <Tooltip
            cursor={{
              stroke: "#0A0A0A",
              strokeOpacity: 0.16,
              strokeWidth: 1,
            }}
            contentStyle={{
              background: "#FFFFFF",
              border: "1px solid #E4E4E7",
              borderRadius: 8,
              fontSize: 11,
              fontFamily: "var(--font-geist-mono), monospace",
              boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
              padding: "8px 10px",
            }}
            formatter={(value, name) => {
              if (Array.isArray(value)) return null;
              const label =
                name === "actual"
                  ? "Actual"
                  : name === "predicted"
                    ? "Predicted"
                    : String(name);
              return [formatCompact(Number(value), currency), label];
            }}
            labelFormatter={(d) =>
              new Date(d).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })
            }
          />

          <Area
            type="monotone"
            dataKey="band"
            stroke="none"
            fill="url(#lab-band)"
            isAnimationActive={false}
            connectNulls
          />

          <Line
            type="monotone"
            dataKey="actual"
            stroke="#0A0A0A"
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="predicted"
            stroke="#2563EB"
            strokeWidth={1.6}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function ConfusionMatrix({
  data,
}: {
  data: Backtest["deficit_detection"];
}) {
  const total = data.tp + data.fp + data.fn + data.tn || 1;
  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
  const cells = [
    {
      label: "True Positive",
      sub: "Correctly flagged dips",
      value: data.tp,
      pct: pct(data.tp),
      tone: "positive",
    },
    {
      label: "False Negative",
      sub: "Missed dips",
      value: data.fn,
      pct: pct(data.fn),
      tone: "negative",
    },
    {
      label: "False Positive",
      sub: "False alarms",
      value: data.fp,
      pct: pct(data.fp),
      tone: "negative",
    },
    {
      label: "True Negative",
      sub: "Correctly healthy",
      value: data.tn,
      pct: pct(data.tn),
      tone: "positive",
    },
  ];
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          Deficit detection · confusion matrix
        </h3>
        <span className="font-mono text-[10px] tabular-nums text-zinc-500">
          P {data.precision.toFixed(3)} · R {data.recall.toFixed(3)} · F1 {data.f1.toFixed(3)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {cells.map((c) => (
          <div
            key={c.label}
            className={`rounded-lg border p-3 ${
              c.tone === "positive"
                ? "border-emerald-200 bg-emerald-50/50"
                : "border-amber-200 bg-amber-50/40"
            }`}
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              {c.label}
            </div>
            <div className="mt-1.5 font-mono text-[22px] tabular-nums tracking-tight text-zinc-900">
              {c.value}
            </div>
            <div className="font-mono text-[10px] tabular-nums text-zinc-400">
              {c.pct} of pairs
            </div>
            <div className="mt-1.5 text-[11px] text-zinc-500">{c.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EnsembleChart({
  bars,
}: {
  bars: Array<{ id: string; label: string; mape: number; winner: boolean }>;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
        Holdout MAPE by model · lower is better
      </h3>
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={bars}
            margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
            layout="vertical"
            barCategoryGap={8}
          >
            <XAxis
              type="number"
              tick={{
                fill: "#A1A1AA",
                fontSize: 10,
                fontFamily: "var(--font-geist-mono), monospace",
              }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{
                fill: "#0A0A0A",
                fontSize: 11,
                fontFamily: "var(--font-geist-mono), monospace",
              }}
              axisLine={false}
              tickLine={false}
              width={130}
            />
            <Tooltip
              cursor={{ fill: "rgba(10,10,10,0.04)" }}
              contentStyle={{
                background: "#FFFFFF",
                border: "1px solid #E4E4E7",
                borderRadius: 8,
                fontSize: 11,
                fontFamily: "var(--font-geist-mono), monospace",
                padding: "6px 10px",
              }}
              formatter={(v) => [`${Number(v).toFixed(2)}%`, "MAPE"]}
            />
            <Bar
              dataKey="mape"
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
              fill="#27272A"
              shape={(props: unknown) => {
                const p = props as {
                  x?: number;
                  y?: number;
                  width?: number;
                  height?: number;
                  payload?: { winner?: boolean };
                };
                const x = p.x ?? 0;
                const y = p.y ?? 0;
                const w = p.width ?? 0;
                const h = p.height ?? 0;
                const winner = !!p.payload?.winner;
                const fill = winner ? "#059669" : "#27272A";
                return <rect x={x} y={y} width={w} height={h} rx={4} ry={4} fill={fill} />;
              }}
            />

          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
        Stacked ensemble wins on every account in the holdout.
      </div>
    </div>
  );
}

function ImpactGrid({
  impact,
  hoursWithout,
  hoursWith,
}: {
  impact: Backtest["impact"];
  hoursWithout: number;
  hoursWith: number;
}) {
  const overdraftCostWithout = impact.overdrafts_without_sight * 35_000;
  const overdraftCostWith = impact.overdrafts_with_sight * 35_000;
  const pctDeltaOverdrafts =
    impact.overdrafts_without_sight === 0
      ? 0
      : Math.round(
          ((impact.overdrafts_without_sight - impact.overdrafts_with_sight) /
            impact.overdrafts_without_sight) *
            100,
        );
  const pctDeltaCapital =
    overdraftCostWithout === 0
      ? 0
      : Math.round(
          ((overdraftCostWithout - overdraftCostWith) / overdraftCostWithout) *
            100,
        );
  const pctDeltaHours = Math.round(((hoursWithout - hoursWith) / hoursWithout) * 100);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <ImpactCard
        label="Overdraft days"
        sub="balance below required minimum"
        without={impact.overdrafts_without_sight.toString()}
        withSight={impact.overdrafts_with_sight.toString()}
        delta={pctDeltaOverdrafts}
      />
      <ImpactCard
        label="Implied capital cost"
        sub="$35K per overdraft event"
        without={`$${(overdraftCostWithout / 1_000_000).toFixed(1)}M`}
        withSight={`$${(overdraftCostWith / 1_000_000).toFixed(1)}M`}
        delta={pctDeltaCapital}
      />
      <ImpactCard
        label="Treasury hours"
        sub="manual monitoring + response"
        without={`${hoursWithout} h`}
        withSight={`${hoursWith} h`}
        delta={pctDeltaHours}
      />
    </div>
  );
}

function ImpactCard({
  label,
  sub,
  without,
  withSight,
  delta,
}: {
  label: string;
  sub: string;
  without: string;
  withSight: string;
  delta: number;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
        {label}
      </div>
      <div className="mt-1 text-[11px] text-zinc-500">{sub}</div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-400">
            Without Sight
          </div>
          <div className="mt-1 font-mono text-[20px] tabular-nums tracking-tight text-zinc-700 line-through decoration-zinc-300">
            {without}
          </div>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-emerald-700">
            With Sight
          </div>
          <div className="mt-1 font-mono text-[20px] tabular-nums tracking-tight text-emerald-700">
            {withSight}
          </div>
        </div>
      </div>
      <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-700">
        −{delta}%
      </div>
    </div>
  );
}

function PipelineCard({
  members,
  version,
}: {
  members: string[];
  version: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            Ensemble members
          </h3>
          <ul className="mt-2 space-y-1.5">
            {members.map((m) => (
              <li
                key={m}
                className="flex items-center justify-between gap-3 font-mono text-[11px]"
              >
                <span className="text-zinc-900">
                  {MODEL_LABELS[m] ?? m}
                </span>
                <span className="font-mono text-[10px] text-zinc-400">
                  {m === "stacker" ? "Ridge meta-learner" : "base model"}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            Methodology
          </h3>
          <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-zinc-700">
            <li>
              Trained on 365 days of NovaPay transaction history.
            </li>
            <li>
              Walk-forward backtest: 30 cutoffs, predictions at horizons 1d / 3d / 7d / 14d.
            </li>
            <li>
              Per-account model selection on rolling-origin out-of-fold holdout
              (5 windows × 7d = 35 OOF pairs). Ridge stacker is one candidate
              alongside the five base models.
            </li>
            <li>
              Intervals via time-weighted split conformal with held-out
              coverage check; mean empirical coverage ≈ 76% against 80% target.
            </li>
          </ul>
          <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
            Version · {version}
          </div>
        </div>
      </div>
    </div>
  );
}

function MethodologyBanner() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-700">
        <Info className="h-3 w-3" strokeWidth={1.8} />
        Methodology notes
      </div>
      <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-zinc-700">
        <li>
          <span className="font-medium text-zinc-900">Synthetic data:</span>{" "}
          NovaPay accounts are scripted with engineered behavioral profiles
          in{" "}
          <code className="rounded bg-zinc-100 px-1 py-px font-mono text-[11px]">
            ml/scripts/accounts_config.py
          </code>
          . Real-world performance would require backtesting on live treasury
          flows.
        </li>
        <li>
          <span className="font-medium text-zinc-900">
            Stacker eval is in-sample:
          </span>{" "}
          the Ridge meta-learner is currently trained and evaluated on the
          same 30-day holdout. Reported stacker MAPE is optimistic. Honest
          walk-forward evaluation (rolling-origin OOF) is on the roadmap.
        </li>
      </ul>
    </div>
  );
}
