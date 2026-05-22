"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Brain, Sparkles } from "lucide-react";
import { accountMetas } from "@/lib/data/accounts";
import { useTimeStore } from "@/lib/store/time-store";
import { useUiStore } from "@/lib/store/ui-store";
import {
  BASE_MODELS,
  MODEL_INFO,
  getEnsembleSnapshot,
  type BaseModel,
} from "@/lib/data/ensemble";
import { getForecastPoint } from "@/lib/utils/forecast";
import { getForecastPointRaw, type ForecastShapItem } from "@/lib/data/forecasts";
import { formatCompact, formatCurrency } from "@/lib/utils/format";
import { NumberTicker } from "@/components/dashboard/number-ticker";
import { ModelIllustration } from "./model-illustrations";

const ACCENT = "#2563EB";
const EASE = [0.16, 1, 0.3, 1] as const;

const panel = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: EASE },
});

type CardId = BaseModel | "stacker" | "final";

export function BrainView() {
  const selectedFromStore = useUiStore((s) => s.selectedAccountId);
  const [localAccountId, setLocalAccountId] = useState<string>(
    selectedFromStore ?? accountMetas[0]?.id ?? "usd-nyc",
  );
  const offset = useTimeStore((s) => s.currentOffset);
  const setOffset = useTimeStore((s) => s.setOffset);
  const [hovered, setHovered] = useState<CardId | null>(null);

  const account = useMemo(
    () => accountMetas.find((a) => a.id === localAccountId) ?? accountMetas[0],
    [localAccountId],
  );

  const snapshot = useMemo(
    () => getEnsembleSnapshot(localAccountId),
    [localAccountId],
  );

  const forecastPoint = useMemo(
    () => getForecastPoint(localAccountId, offset),
    [localAccountId, offset],
  );

  const shap = useMemo<ForecastShapItem[]>(() => {
    const raw = getForecastPointRaw(localAccountId, offset);
    return raw?.shap ?? [];
  }, [localAccountId, offset]);

  if (!account || !snapshot) {
    return (
      <div className="flex h-full items-center justify-center bg-[#FAFAFA] text-zinc-500">
        Account data not available.
      </div>
    );
  }

  const finalBalance = forecastPoint?.balance ?? 0;
  const finalP10 = forecastPoint?.p10 ?? 0;
  const finalP90 = forecastPoint?.p90 ?? 0;
  const isHistorical = forecastPoint?.isHistorical ?? false;
  const status: "healthy" | "warning" | "critical" =
    finalBalance < account.minBalance * 0.5
      ? "critical"
      : finalBalance < account.minBalance
        ? "warning"
        : "healthy";

  return (
    <div className="grid h-screen min-h-0 grid-rows-[56px_1fr] bg-[#FAFAFA]">
      <TopBar
        accountId={localAccountId}
        onAccountChange={setLocalAccountId}
        offset={offset}
        onOffsetChange={setOffset}
        chosen={snapshot.chosen}
      />

      <div className="flex min-h-0 flex-col gap-3 p-4">
        <motion.div
          {...panel(0.06)}
          className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-zinc-200/80 bg-white/60 p-5"
        >
          <Pipeline
            snapshot={snapshot}
            finalBalance={finalBalance}
            finalP10={finalP10}
            finalP90={finalP90}
            currency={account.currency}
            isHistorical={isHistorical}
            minBalance={account.minBalance}
            status={status}
            hovered={hovered}
            setHovered={setHovered}
          />
        </motion.div>

        <motion.div {...panel(0.14)} className="grid gap-3 md:grid-cols-3">
          <InspectingPanel hovered={hovered} />
          <LeaderboardPanel snapshot={snapshot} />
          <WhyPanel
            shap={shap}
            isHistorical={isHistorical}
            offset={offset}
            currency={account.currency}
          />
        </motion.div>
      </div>
    </div>
  );
}

interface TopBarProps {
  accountId: string;
  onAccountChange: (id: string) => void;
  offset: number;
  onOffsetChange: (n: number) => void;
  chosen: string;
}

function TopBar({
  accountId,
  onAccountChange,
  offset,
  onOffsetChange,
  chosen,
}: TopBarProps) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200/80 bg-white px-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={1.8} />
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-900">
          NovaPay
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-300">
          /
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-900">
          <Brain className="h-3 w-3" strokeWidth={1.8} />
          Brain
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
            Account
          </span>
          <div className="relative">
            <select
              value={accountId}
              onChange={(e) => onAccountChange(e.target.value)}
              className="appearance-none rounded-md border border-zinc-200/80 bg-white py-1 pl-2.5 pr-7 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-900 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            >
              {accountMetas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[8px] text-zinc-400">
              ▼
            </span>
          </div>
        </div>

        <div className="flex w-[260px] items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
            Offset
          </span>
          <input
            type="range"
            min={-30}
            max={14}
            value={offset}
            onChange={(e) => onOffsetChange(Number(e.target.value))}
            className="flex-1 accent-zinc-900"
          />
          <span className="font-mono text-[10px] tabular-nums text-zinc-900 w-10 text-right">
            {offset === 0 ? "now" : offset > 0 ? `+${offset}d` : `${offset}d`}
          </span>
        </div>

        <span
          className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]"
          style={{
            color: ACCENT,
            borderColor: `${ACCENT}33`,
            background: `${ACCENT}0a`,
          }}
        >
          chosen · {chosen}
        </span>
      </div>
    </header>
  );
}

interface PipelineProps {
  snapshot: ReturnType<typeof getEnsembleSnapshot>;
  finalBalance: number;
  finalP10: number;
  finalP90: number;
  currency: string;
  isHistorical: boolean;
  minBalance: number;
  status: "healthy" | "warning" | "critical";
  hovered: CardId | null;
  setHovered: (id: CardId | null) => void;
}

function Pipeline({
  snapshot,
  finalBalance,
  finalP10,
  finalP90,
  currency,
  isHistorical,
  minBalance,
  status,
  hovered,
  setHovered,
}: PipelineProps) {
  if (!snapshot) return null;

  const sortedByMape = [...BASE_MODELS].sort(
    (a, b) => snapshot.mapes[a] - snapshot.mapes[b],
  );
  const bestMape = sortedByMape[0];
  const stackerActive = snapshot.chosen === "stacker";
  const chosenBase = BASE_MODELS.includes(snapshot.chosen as BaseModel)
    ? (snapshot.chosen as BaseModel)
    : null;

  return (
    <>
      <SectionLabel num="01" title="Base models" />

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        {BASE_MODELS.map((m, i) => (
          <ModelCard
            key={m}
            index={i}
            model={m}
            weight={snapshot.weights[m]}
            mape={snapshot.mapes[m]}
            isBest={m === bestMape}
            isSelected={m === chosenBase}
            hovered={hovered}
            setHovered={setHovered}
          />
        ))}
      </div>

      <Connections
        weights={snapshot.weights}
        hovered={hovered}
        stackerActive={stackerActive}
      />

      <SectionLabel
        num="02"
        title={
          stackerActive ? "Stacker · selected" : "Stacker · reference only"
        }
      />

      <div className="mt-3">
        <StackerCard
          stackerMape={snapshot.stackerMape}
          balance={finalBalance}
          p10={finalP10}
          p90={finalP90}
          currency={currency}
          hovered={hovered}
          setHovered={setHovered}
          active={stackerActive}
        />
      </div>

      <DownLine />

      <SectionLabel num="03" title="Final" />

      <div className="mt-3 pb-2">
        <FinalCard
          balance={finalBalance}
          p10={finalP10}
          p90={finalP90}
          minBalance={minBalance}
          currency={currency}
          status={status}
          isHistorical={isHistorical}
          hovered={hovered}
          setHovered={setHovered}
        />
      </div>
    </>
  );
}

function SectionLabel({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-[10px] tabular-nums text-zinc-300">
        {num}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
        {title}
      </span>
    </div>
  );
}

interface ModelCardProps {
  index: number;
  model: BaseModel;
  weight: number;
  mape: number;
  isBest: boolean;
  isSelected: boolean;
  hovered: CardId | null;
  setHovered: (id: CardId | null) => void;
}

function ModelCard({
  index,
  model,
  weight,
  mape,
  isBest,
  isSelected,
  hovered,
  setHovered,
}: ModelCardProps) {
  const info = MODEL_INFO[model];
  const isFocused = hovered === model;
  const isDimmed = hovered !== null && !isFocused;

  const mapeTone =
    mape < 3
      ? "text-emerald-600"
      : mape < 6
        ? "text-zinc-900"
        : mape < 10
          ? "text-amber-600"
          : "text-red-600";
  const dotTone =
    mape < 3
      ? "bg-emerald-500"
      : mape < 6
        ? "bg-zinc-900"
        : mape < 10
          ? "bg-amber-500"
          : "bg-red-500";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: isDimmed ? 0.32 : 1,
        y: 0,
        scale: isFocused ? 1.02 : 1,
      }}
      transition={{
        duration: 0.4,
        delay: 0.1 + index * 0.05,
        ease: EASE,
      }}
      onMouseEnter={() => setHovered(model)}
      onMouseLeave={() => setHovered(null)}
      className={`relative overflow-hidden rounded-lg border bg-white transition-colors ${
        isFocused
          ? "border-zinc-900 shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
          : isSelected
            ? "border-emerald-400 shadow-[0_4px_18px_rgba(16,185,129,0.18)]"
            : "border-zinc-200/80 hover:border-zinc-300"
      }`}
    >
      {isSelected ? (
        <span
          className="absolute right-1.5 top-1.5 z-10 inline-flex items-center gap-0.5 rounded-full border px-1 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em]"
          style={{
            color: "#047857",
            background: "#ECFDF5",
            borderColor: "#A7F3D0",
          }}
        >
          <Sparkles className="h-2 w-2" strokeWidth={2} />
          Selected
        </span>
      ) : isBest ? (
        <span
          className="absolute right-1.5 top-1.5 z-10 inline-flex items-center gap-0.5 rounded-full border bg-white px-1 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em]"
          style={{
            color: ACCENT,
            borderColor: `${ACCENT}55`,
          }}
        >
          <Sparkles className="h-2 w-2" strokeWidth={2} />
          Best
        </span>
      ) : null}

      <div className="px-2 pt-2">
        <ModelIllustration model={model} active={isFocused} />
      </div>

      <div className="px-3 pb-3 pt-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono text-[11px] uppercase tracking-[0.10em] text-zinc-900">
              {info.name}
            </div>
            <div className="mt-0.5 text-[10px] leading-tight text-zinc-500">
              {info.family}
            </div>
          </div>
          <span
            className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dotTone}`}
          />
        </div>

        <div className="mt-2.5 flex items-baseline gap-1">
          <span
            className={`font-mono text-[18px] tabular-nums leading-none ${mapeTone}`}
          >
            <NumberTicker
              value={mape}
              format={(n) => n.toFixed(2)}
              duration={0.6}
            />
          </span>
          <span className="font-mono text-[9px] text-zinc-500">% MAPE</span>
        </div>

        <div className="mt-2">
          <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500">
            <span>Weight</span>
            <span className="tabular-nums text-zinc-900">
              <NumberTicker
                value={weight * 100}
                format={(n) => n.toFixed(0)}
              />
              %
            </span>
          </div>
          <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-zinc-100">
            <motion.div
              className="h-full"
              style={{ background: ACCENT }}
              initial={{ width: 0 }}
              animate={{ width: `${weight * 100}%` }}
              transition={{ duration: 0.7, ease: EASE }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface ConnectionsProps {
  weights: Record<BaseModel, number>;
  hovered: CardId | null;
  stackerActive: boolean;
}

function Connections({ weights, hovered, stackerActive }: ConnectionsProps) {
  const width = 1100;
  const height = 130;
  const numCards = BASE_MODELS.length;
  const gapPct = 0.04;
  const colWidth = (1 - gapPct * (numCards - 1)) / numCards;

  const TOP_WIDTH = 38;
  const tops = BASE_MODELS.map((_, i) => {
    const left = i * (colWidth + gapPct);
    const center = (left + colWidth / 2) * width;
    return {
      left: center - TOP_WIDTH / 2,
      right: center + TOP_WIDTH / 2,
      center,
    };
  });

  const BAR_WIDTH = 540;
  const barLeft = (width - BAR_WIDTH) / 2;
  let cursor = barLeft;
  const bots = BASE_MODELS.map((m) => {
    const w = weights[m] * BAR_WIDTH;
    const left = cursor;
    const right = cursor + w;
    cursor = right;
    return { left, right, center: (left + right) / 2, width: w };
  });

  const topY = 4;
  const barY = height - 26;
  const barH = 6;
  const midY = (topY + barY) / 2;

  return (
    <div className="relative mx-auto my-3" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="sankey-flow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.10" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0.40" />
          </linearGradient>
          <linearGradient id="sankey-flow-hot" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.35" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0.80" />
          </linearGradient>
        </defs>

        {BASE_MODELS.map((m, i) => {
          const top = tops[i];
          const bot = bots[i];
          const dimmed = hovered !== null && hovered !== m;
          const highlighted = hovered === m;
          const d = `M ${top.left} ${topY} L ${top.right} ${topY} C ${top.right} ${midY}, ${bot.right} ${midY}, ${bot.right} ${barY} L ${bot.left} ${barY} C ${bot.left} ${midY}, ${top.left} ${midY}, ${top.left} ${topY} Z`;
          const baseOpacity = stackerActive ? 1 : 0.35;
          return (
            <motion.path
              key={`flow-${m}`}
              d={d}
              fill={highlighted ? "url(#sankey-flow-hot)" : "url(#sankey-flow)"}
              initial={{ opacity: 0 }}
              animate={{
                opacity: dimmed ? 0.07 : baseOpacity,
              }}
              transition={{
                opacity: {
                  duration: 0.5,
                  delay: 0.15 + i * 0.05,
                  ease: EASE,
                },
              }}
            />
          );
        })}

        {bots.map((bot, i) => {
          const m = BASE_MODELS[i];
          const dimmed = hovered !== null && hovered !== m;
          const highlighted = hovered === m;
          const inset = 1;
          const isFirst = i === 0;
          const isLast = i === numCards - 1;
          return (
            <rect
              key={`seg-${m}`}
              x={bot.left + (isFirst ? 0 : inset / 2)}
              y={barY}
              width={Math.max(
                1,
                bot.width - (isFirst ? inset / 2 : inset / 2) - (isLast ? inset / 2 : inset / 2),
              )}
              height={barH}
              rx={isFirst || isLast ? 2 : 0}
              fill={ACCENT}
              opacity={dimmed ? 0.18 : highlighted ? 1 : 0.7}
              style={{ transition: "opacity 200ms" }}
            />
          );
        })}

        {bots.map((bot, i) => {
          const m = BASE_MODELS[i];
          const w = weights[m];
          const dimmed = hovered !== null && hovered !== m;
          const highlighted = hovered === m;
          if (bot.width < 20) return null;
          return (
            <text
              key={`lbl-${m}`}
              x={bot.center}
              y={barY - 6}
              textAnchor="middle"
              fontSize={9.5}
              fontFamily="var(--font-geist-mono), monospace"
              fontWeight={500}
              fill={highlighted ? ACCENT : "#52525B"}
              opacity={dimmed ? 0.35 : 1}
              style={{ transition: "opacity 200ms, fill 200ms" }}
            >
              {(w * 100).toFixed(0)}%
            </text>
          );
        })}

        <text
          x={barLeft - 10}
          y={barY + barH / 2 + 3}
          textAnchor="end"
          fontSize={8.5}
          fontFamily="var(--font-geist-mono), monospace"
          fill="#A1A1AA"
          letterSpacing="1.2"
        >
          Σ wᵢ ŷᵢ
        </text>

        <text
          x={barLeft + BAR_WIDTH / 2}
          y={height - 4}
          textAnchor="middle"
          fontSize={8}
          fontFamily="var(--font-geist-mono), monospace"
          fill="#A1A1AA"
          letterSpacing="2"
        >
          WEIGHTED CONTRIBUTION
        </text>
      </svg>
    </div>
  );
}

interface StackerCardProps {
  stackerMape: number | null;
  balance: number;
  p10: number;
  p90: number;
  currency: string;
  hovered: CardId | null;
  setHovered: (id: CardId | null) => void;
  active: boolean;
}

function StackerCard({
  stackerMape,
  balance,
  p10,
  p90,
  currency,
  hovered,
  setHovered,
  active,
}: StackerCardProps) {
  const isFocused = hovered === "stacker";
  const dimmed = hovered !== null && !isFocused;
  const restingOpacity = active ? 1 : 0.55;

  return (
    <motion.div
      onMouseEnter={() => setHovered("stacker")}
      onMouseLeave={() => setHovered(null)}
      animate={{
        opacity: dimmed ? 0.35 : restingOpacity,
        scale: isFocused ? 1.01 : 1,
      }}
      transition={{ duration: 0.22, ease: EASE }}
      className="mx-auto max-w-[520px] rounded-xl border bg-white p-4"
      style={{
        borderColor: active ? `${ACCENT}55` : "#E4E4E7",
        boxShadow: isFocused
          ? `0 12px 30px rgba(37,99,235,0.12)`
          : active
            ? `0 0 0 1px ${ACCENT}11`
            : "none",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div
            className="font-mono text-[10px] uppercase tracking-[0.14em]"
            style={{ color: active ? ACCENT : "#71717A" }}
          >
            Ridge Stacker
            {!active && (
              <span className="ml-2 normal-case tracking-normal text-zinc-400">
                · not selected for this account
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-zinc-500">
            Positive-constrained · α=1.0
          </div>
          <div className="mt-1 text-[10px] leading-snug text-zinc-400">
            Display weights ≈ 1/MAPE normalized · actual ridge coefficients in{" "}
            <code className="font-mono">ml/models/*_stacker.pkl</code>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400">
            Holdout MAPE
          </div>
          <div
            className="font-mono text-[13px] tabular-nums"
            style={{ color: ACCENT }}
          >
            {stackerMape !== null ? (
              <>
                <NumberTicker
                  value={stackerMape}
                  format={(n) => n.toFixed(2)}
                  duration={0.6}
                />
                %
              </>
            ) : (
              "—"
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400">
            Weighted prediction
          </div>
          <div className="mt-0.5 font-mono text-[26px] tabular-nums leading-none tracking-tight text-zinc-900">
            {formatCurrency(balance, currency)}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400">
            P10 — P90
          </div>
          <div className="mt-0.5 font-mono text-[11px] tabular-nums text-zinc-600">
            {formatCompact(p10, currency)} → {formatCompact(p90, currency)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function DownLine() {
  return (
    <div className="mx-auto my-3 h-6 w-px bg-zinc-200" />
  );
}

interface FinalCardProps {
  balance: number;
  p10: number;
  p90: number;
  minBalance: number;
  currency: string;
  status: "healthy" | "warning" | "critical";
  isHistorical: boolean;
  hovered: CardId | null;
  setHovered: (id: CardId | null) => void;
}

function FinalCard({
  balance,
  p10,
  p90,
  minBalance,
  currency,
  status,
  isHistorical,
  hovered,
  setHovered,
}: FinalCardProps) {
  const STATUS_PILL: Record<typeof status, string> = {
    healthy: "border-zinc-200 text-zinc-600 bg-white",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    critical: "border-red-200 bg-red-50 text-red-700",
  };
  const STATUS_DOT: Record<typeof status, string> = {
    healthy: "bg-zinc-900",
    warning: "bg-amber-500",
    critical: "bg-red-600",
  };
  const isFocused = hovered === "final";
  const dimmed = hovered !== null && !isFocused;

  return (
    <motion.div
      onMouseEnter={() => setHovered("final")}
      onMouseLeave={() => setHovered(null)}
      animate={{
        opacity: dimmed ? 0.45 : 1,
        scale: isFocused ? 1.01 : 1,
      }}
      transition={{ duration: 0.22, ease: EASE }}
      className={`mx-auto max-w-[420px] rounded-xl border bg-white p-4 transition-colors ${
        isFocused
          ? "border-zinc-900 shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
          : "border-zinc-200/80"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`}
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            Final forecast
          </span>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${STATUS_PILL[status]}`}
        >
          {isHistorical ? "actual" : status}
        </span>
      </div>
      <div className="mt-2 font-mono text-[26px] tabular-nums leading-tight tracking-tight text-zinc-900">
        {formatCurrency(balance, currency)}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="font-mono text-zinc-500 tabular-nums">
          P10 {formatCompact(p10, currency)} · P90 {formatCompact(p90, currency)}
        </span>
        <span className="font-mono text-zinc-400 tabular-nums">
          min {formatCompact(minBalance, currency)}
        </span>
      </div>
    </motion.div>
  );
}

function InspectingPanel({ hovered }: { hovered: CardId | null }) {
  const info =
    hovered && hovered in MODEL_INFO
      ? MODEL_INFO[hovered as keyof typeof MODEL_INFO]
      : null;

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white/60 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
        Inspecting
      </div>
      <AnimatePresence mode="wait">
        {info ? (
          <motion.div
            key={info.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="mt-2"
          >
            <div className="flex items-baseline gap-2">
              <div className="font-mono text-[13px] tracking-tight text-zinc-900">
                {info.name}
              </div>
              <div className="font-mono text-[10px] text-zinc-400">
                {info.paper}
              </div>
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500">
              {info.family}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-zinc-700">
              {info.tagline}
            </p>
          </motion.div>
        ) : (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-2 text-[12px] leading-relaxed text-zinc-500"
          >
            Hover any node above to inspect it.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function WhyPanel({
  shap,
  isHistorical,
  offset,
  currency,
}: {
  shap: ForecastShapItem[];
  isHistorical: boolean;
  offset: number;
  currency: string;
}) {
  const empty = shap.length === 0;
  const items = [...shap]
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 5);
  const maxAbs = items.reduce((m, x) => Math.max(m, Math.abs(x.impact)), 1);

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white/60 p-4">
      <div className="flex items-baseline justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
          Why this forecast
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
          SHAP · top 5
        </div>
      </div>

      {empty ? (
        <p className="mt-3 text-[12px] leading-relaxed text-zinc-500">
          {isHistorical
            ? "Historical point — no model attribution. Drag Time Machine into the future to see why."
            : `No SHAP attribution available for offset +${offset}d. LightGBM model required.`}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item) => {
            const pct = (Math.abs(item.impact) / maxAbs) * 100;
            const isNegative = item.impact < 0;
            return (
              <div key={item.feature} className="space-y-0.5">
                <div className="flex items-baseline justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.08em]">
                  <span className="truncate text-zinc-700">{item.label}</span>
                  <span
                    className={`tabular-nums ${isNegative ? "text-red-600" : "text-emerald-600"}`}
                  >
                    {isNegative ? "−" : "+"}
                    {formatCompact(Math.abs(item.impact), currency)}
                  </span>
                </div>
                <div className="relative h-1 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={`absolute top-0 bottom-0 ${
                      isNegative ? "right-1/2 bg-red-400" : "left-1/2 bg-emerald-400"
                    }`}
                    style={{ width: `${Math.max(4, pct / 2)}%` }}
                  />
                  <div className="absolute left-1/2 top-0 h-full w-px bg-zinc-300" />
                </div>
              </div>
            );
          })}
          <p className="pt-2 text-[10px] leading-snug text-zinc-500">
            Negative impact pushes the forecast down. Positive supports it.
            Magnitudes are LightGBM SHAP values in {currency}.
          </p>
        </div>
      )}
    </div>
  );
}

function LeaderboardPanel({
  snapshot,
}: {
  snapshot: ReturnType<typeof getEnsembleSnapshot>;
}) {
  if (!snapshot) return null;
  const sortedByMape = [...BASE_MODELS].sort(
    (a, b) => snapshot.mapes[a] - snapshot.mapes[b],
  );

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white/60 p-4">
      <div className="flex items-baseline justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
          Leaderboard · this account
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
          MAPE ↑
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {sortedByMape.map((m, i) => (
          <LeaderboardRow
            key={m}
            rank={i + 1}
            name={MODEL_INFO[m].name}
            weight={snapshot.weights[m]}
            mape={snapshot.mapes[m]}
            isChosen={snapshot.chosen === m}
          />
        ))}
        <StackerLeaderboardRow
          stackerMape={snapshot.stackerMape}
          chosen={snapshot.chosen}
        />
      </div>
    </div>
  );
}

function StackerLeaderboardRow({
  stackerMape,
  chosen,
}: {
  stackerMape: number | null;
  chosen: string;
}) {
  const isWinner = chosen === "stacker";
  return (
    <div
      className="mt-2 flex items-center gap-2 rounded-md border px-2 py-1.5 font-mono text-[11px]"
      style={{
        borderColor: isWinner ? `${ACCENT}55` : "#E4E4E7",
        background: isWinner ? `${ACCENT}0a` : "transparent",
      }}
    >
      <span className="font-mono text-[10px] text-zinc-400">
        {isWinner ? "★" : "·"}
      </span>
      <span
        style={{ color: isWinner ? ACCENT : "#71717A" }}
        className="w-16"
      >
        Stacker
      </span>
      <div className="flex-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
        {isWinner ? "chosen" : "meta-learner · not chosen on this account"}
      </div>
      <span
        className="tabular-nums"
        style={{ color: isWinner ? ACCENT : "#71717A" }}
      >
        {stackerMape !== null ? `${stackerMape.toFixed(2)}%` : "—"}
      </span>
    </div>
  );
}

interface LeaderboardRowProps {
  rank: number;
  name: string;
  weight: number;
  mape: number;
  isChosen?: boolean;
}

function LeaderboardRow({
  rank,
  name,
  weight,
  mape,
  isChosen,
}: LeaderboardRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay: 0.04 * rank }}
      className="flex items-center gap-2 font-mono text-[11px]"
    >
      <span className="w-3 text-right tabular-nums text-zinc-300">{rank}</span>
      <span
        className={`w-16 ${isChosen ? "font-medium" : ""}`}
        style={{ color: isChosen ? ACCENT : "#27272A" }}
      >
        {name}
        {isChosen && (
          <span
            className="ml-1 font-mono text-[9px]"
            style={{ color: ACCENT }}
            aria-label="chosen for this account"
          >
            ★
          </span>
        )}
      </span>
      <div className="flex-1 h-[4px] overflow-hidden rounded-full bg-zinc-100">
        <motion.div
          className="h-full"
          style={{ background: ACCENT, opacity: 0.55 + weight * 0.45 }}
          initial={{ width: 0 }}
          animate={{ width: `${weight * 100}%` }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.08 }}
        />
      </div>
      <span className="w-9 text-right tabular-nums text-zinc-900">
        {(weight * 100).toFixed(0)}%
      </span>
      <span className="w-12 text-right tabular-nums text-zinc-500">
        {mape.toFixed(2)}%
      </span>
    </motion.div>
  );
}
