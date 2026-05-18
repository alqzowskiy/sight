"use client";

import { motion } from "motion/react";

const ease = [0.16, 1, 0.3, 1] as const;

type SignatureKind = "prophet" | "lightgbm" | "arima" | "ets" | "chronos";

interface ModelCard {
  name: string;
  source: string;
  year: string;
  catches: string;
  mape: number;
  rank: number;
  signature: SignatureKind;
}

const MODELS: ModelCard[] = [
  {
    name: "Prophet",
    source: "Facebook",
    year: "2017",
    catches: "Trend, weekly seasonality, country holidays",
    mape: 4.91,
    rank: 2,
    signature: "prophet",
  },
  {
    name: "LightGBM",
    source: "Microsoft",
    year: "2017",
    catches: "Cross-account features, lag interactions, payday cycles",
    mape: 9.38,
    rank: 6,
    signature: "lightgbm",
  },
  {
    name: "ARIMA",
    source: "Classical",
    year: "1970s",
    catches: "Short-term autocorrelation",
    mape: 7.84,
    rank: 4,
    signature: "arima",
  },
  {
    name: "Holt-Winters",
    source: "Classical",
    year: "1960s",
    catches: "Exponential smoothing with trend + seasonal",
    mape: 9.01,
    rank: 5,
    signature: "ets",
  },
  {
    name: "Chronos",
    source: "Amazon Science",
    year: "2024",
    catches: "Patterns learned from millions of time series",
    mape: 5.43,
    rank: 3,
    signature: "chronos",
  },
];

const MAX_MAPE = 10;

export function ModelsSection() {
  return (
    <section
      id="models"
      className="border-t border-zinc-200/80 bg-[#FAFAFA] px-6 py-24 md:px-10 lg:px-16"
    >
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-12 flex items-baseline justify-between gap-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              The ensemble
            </div>
            <h2 className="mt-2 max-w-[640px] text-[34px] font-medium leading-[1.05] tracking-[-0.02em] text-zinc-900 md:text-[44px]">
              Five forecasters with different specialities. One meta-learner
              decides who to trust.
            </h2>
          </div>
          <p className="hidden max-w-[320px] text-[13px] leading-relaxed text-zinc-500 md:block">
            Each model is wrong in its own way. A Ridge regression learns the
            optimal weighted combination per account — the stacked ensemble
            wins on all 11.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          {MODELS.map((m, i) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease }}
              className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-[15px] font-medium text-zinc-900">
                  {m.name}
                </h3>
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-400">
                  #{m.rank}
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500">
                {m.source} · {m.year}
              </div>
              <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
                <ModelSignature
                  kind={m.signature}
                  delay={Math.round(i * 10) / 100}
                />
              </div>
              <p className="mt-3 flex-1 text-[12px] leading-relaxed text-zinc-600">
                {m.catches}
              </p>
              <div className="mt-4 space-y-1.5">
                <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                  <span>Holdout MAPE</span>
                  <span className="tabular-nums text-zinc-900">
                    {m.mape.toFixed(2)}%
                  </span>
                </div>
                <BarFill ratio={m.mape / MAX_MAPE} tone="zinc" />
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, delay: 0.5, ease }}
          className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5"
        >
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="rounded bg-emerald-700 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white">
                  Winner
                </span>
                <h3 className="text-[16px] font-medium text-zinc-900">
                  Stacked Ensemble · Ridge meta-learner
                </h3>
              </div>
              <p className="mt-2 max-w-[640px] text-[12.5px] leading-relaxed text-zinc-600">
                The meta-learner sees the five base predictions for each day,
                learns optimal weights per account, and outputs a single
                combined forecast. Better than any individual model on every
                account in the backtest.
              </p>
              <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-800">
                Wins on 11 of 11 accounts · 42% better than Prophet alone
              </div>
            </div>
            <div className="w-[240px]">
              <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-700">
                <span>MAPE</span>
                <span className="tabular-nums text-emerald-900">2.83%</span>
              </div>
              <BarFill ratio={2.83 / MAX_MAPE} tone="emerald" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ModelSignature({
  kind,
  delay,
}: {
  kind: SignatureKind;
  delay: number;
}) {
  const w = 220;
  const h = 50;
  if (kind === "prophet") {
    const points: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const x = (i / 40) * w;
      const seasonal = Math.sin((i / 40) * Math.PI * 4) * 8;
      const trend = (i / 40) * 10 - 6;
      points.push([x, h / 2 - seasonal + trend]);
    }
    const path = points
      .map(
        ([x, y], i) =>
          `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`,
      )
      .join(" ");
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="block h-auto w-full">
        {[18, 110, 195].map((x, i) => (
          <line
            key={i}
            x1={x}
            x2={x}
            y1={4}
            y2={h - 4}
            stroke="#FBBF24"
            strokeOpacity="0.4"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        ))}
        <motion.path
          d={path}
          fill="none"
          stroke="#0A0A0A"
          strokeWidth="1.5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
    );
  }
  if (kind === "lightgbm") {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="block h-auto w-full">
        <Branch sx={w / 2} sy={6} dx={-50} dy={20} delay={delay} />
        <Branch sx={w / 2} sy={6} dx={50} dy={20} delay={delay} />
        <Branch sx={w / 2 - 50} sy={26} dx={-32} dy={18} delay={delay + 0.1} />
        <Branch sx={w / 2 - 50} sy={26} dx={20} dy={18} delay={delay + 0.1} />
        <Branch sx={w / 2 + 50} sy={26} dx={-20} dy={18} delay={delay + 0.15} />
        <Branch sx={w / 2 + 50} sy={26} dx={32} dy={18} delay={delay + 0.15} />
        <Leaf x={w / 2 - 82} y={44} delay={delay + 0.5} />
        <Leaf x={w / 2 - 30} y={44} delay={delay + 0.55} />
        <Leaf x={w / 2 + 30} y={44} delay={delay + 0.6} />
        <Leaf x={w / 2 + 82} y={44} delay={delay + 0.65} />
        <circle cx={w / 2} cy={6} r="3" fill="#0A0A0A" />
        <circle cx={w / 2 - 50} cy={26} r="2.5" fill="#0A0A0A" opacity="0.7" />
        <circle cx={w / 2 + 50} cy={26} r="2.5" fill="#0A0A0A" opacity="0.7" />
      </svg>
    );
  }
  if (kind === "arima") {
    const bars = [0.95, 0.7, 0.5, 0.35, 0.28, 0.18, 0.14, 0.1, 0.08, 0.06];
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="block h-auto w-full">
        <line
          x1={4}
          x2={w - 4}
          y1={h - 6}
          y2={h - 6}
          stroke="#0A0A0A"
          strokeOpacity="0.18"
          strokeWidth="1"
        />
        {bars.map((b, i) => {
          const bw = 14;
          const gap = 6;
          const x = 6 + i * (bw + gap);
          const bh = b * (h - 12);
          return (
            <motion.rect
              key={i}
              x={x}
              y={h - 6 - bh}
              width={bw}
              height={bh}
              fill="#0A0A0A"
              opacity={0.95 - i * 0.07}
              initial={{ scaleY: 0, transformOrigin: `${x}px ${h - 6}px` }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.5,
                delay: delay + i * 0.06,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{ transformOrigin: `${x}px ${h - 6}px` }}
            />
          );
        })}
      </svg>
    );
  }
  if (kind === "ets") {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const x = (i / 40) * w;
      const t = i / 40;
      const decay = Math.exp(-t * 2) * 14;
      const y = h - 8 - 16 - decay * Math.sin(t * Math.PI * 3);
      pts.push([x, y]);
    }
    const path = pts
      .map(
        ([x, y], i) =>
          `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`,
      )
      .join(" ");
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="block h-auto w-full">
        <line
          x1={4}
          x2={w - 4}
          y1={h / 2}
          y2={h / 2}
          stroke="#0A0A0A"
          strokeOpacity="0.12"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
        <motion.path
          d={path}
          fill="none"
          stroke="#0A0A0A"
          strokeWidth="1.5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, delay, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
    );
  }
  if (kind === "chronos") {
    const cols: { x: number; ys: number[] }[] = [
      { x: 18, ys: [12, 25, 38] },
      { x: 70, ys: [10, 22, 34, 46] },
      { x: 130, ys: [10, 22, 34, 46] },
      { x: 190, ys: [16, 30] },
      { x: 218, ys: [25] },
    ];
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="block h-auto w-full">
        {cols.slice(0, -1).map((c, ci) => {
          const next = cols[ci + 1];
          return c.ys.flatMap((y) =>
            next.ys.map((ny, ni) => (
              <motion.line
                key={`${ci}-${y}-${ni}`}
                x1={c.x}
                x2={next.x}
                y1={y}
                y2={ny}
                stroke="#0A0A0A"
                strokeOpacity="0.18"
                strokeWidth="0.8"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.6,
                  delay: delay + ci * 0.15,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
            )),
          );
        })}
        {cols.map((c, ci) =>
          c.ys.map((y) => (
            <motion.circle
              key={`${ci}-${y}`}
              cx={c.x}
              cy={y}
              r="2.5"
              fill="#0A0A0A"
              initial={{ scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.3,
                delay: delay + ci * 0.12,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
          )),
        )}
        <text
          x={w - 10}
          y={h - 4}
          textAnchor="end"
          fontFamily="var(--font-geist-mono), monospace"
          fontSize="7"
          fill="#71717A"
        >
          transformer
        </text>
      </svg>
    );
  }
  return null;
}

function Branch({
  sx,
  sy,
  dx,
  dy,
  delay,
}: {
  sx: number;
  sy: number;
  dx: number;
  dy: number;
  delay: number;
}) {
  return (
    <motion.line
      x1={sx}
      y1={sy}
      x2={sx + dx}
      y2={sy + dy}
      stroke="#0A0A0A"
      strokeOpacity="0.5"
      strokeWidth="1.2"
      initial={{ pathLength: 0 }}
      whileInView={{ pathLength: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}

function Leaf({
  x,
  y,
  delay,
}: {
  x: number;
  y: number;
  delay: number;
}) {
  return (
    <motion.rect
      x={x - 3}
      y={y - 3}
      width="6"
      height="6"
      rx="1"
      fill="#FBBF24"
      initial={{ opacity: 0, scale: 0 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}

function BarFill({ ratio, tone }: { ratio: number; tone: "zinc" | "emerald" }) {
  const width = `${Math.min(100, ratio * 100)}%`;
  const fill = tone === "emerald" ? "bg-emerald-600" : "bg-zinc-900";
  const bg = tone === "emerald" ? "bg-emerald-200/60" : "bg-zinc-100";
  return (
    <div className={`relative h-1.5 overflow-hidden rounded-full ${bg}`}>
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className={`absolute inset-y-0 left-0 rounded-full ${fill}`}
      />
    </div>
  );
}
