"use client";

import { motion } from "motion/react";
import { Database, Cpu, FileJson, LayoutDashboard } from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as const;

const STAGES = [
  {
    icon: Database,
    title: "Transaction history",
    body: "180 days of NovaPay transactions across 11 accounts. Clearing delays, holidays, weekly cycles — all encoded.",
    tag: "Python · pandas",
  },
  {
    icon: Cpu,
    title: "Ensemble training",
    body: "Five ML models train in parallel: Prophet, LightGBM with quantile loss, ARIMA, Holt-Winters ETS, Amazon Chronos.",
    tag: "scikit-learn · lightgbm · prophet · transformers",
  },
  {
    icon: FileJson,
    title: "Forecast export",
    body: "Stacked Ridge meta-learner picks optimal weights per account. Output: a static forecasts.json with 14-day predictions.",
    tag: "joblib · numpy",
  },
  {
    icon: LayoutDashboard,
    title: "Live dashboard",
    body: "Next.js reads the JSON, renders the 3D globe, Time Machine slider, alerts, and AI insights — no backend, no Python at runtime.",
    tag: "Next.js · cobe · OpenAI",
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="border-t border-zinc-200/80 bg-white px-6 py-24 md:px-10 lg:px-16"
    >
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-12 flex items-baseline justify-between gap-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              How it works
            </div>
            <h2 className="mt-2 max-w-[640px] text-[34px] font-medium leading-[1.05] tracking-[-0.02em] text-zinc-900 md:text-[44px]">
              Train once offline. Serve forecasts instantly forever.
            </h2>
          </div>
          <p className="hidden max-w-[320px] text-[13px] leading-relaxed text-zinc-500 md:block">
            Batch inference — the same architecture Spotify, Netflix and
            Bloomberg use for prediction at scale.
          </p>
        </div>

        <div className="relative">
          <PipelineFlow />
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.55, delay: i * 0.08, ease }}
                className="relative rounded-xl border border-zinc-200 bg-white p-5"
              >
                <div className="absolute -top-2.5 left-5 rounded-full bg-zinc-900 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-white">
                  Step {i + 1}
                </div>
                <Icon className="h-5 w-5 text-zinc-900" strokeWidth={1.5} />
                <h3 className="mt-3 text-[15px] font-medium text-zinc-900">
                  {s.title}
                </h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-600">
                  {s.body}
                </p>
                <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-400">
                  {s.tag}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const PIPELINE_VB_W = 960;
const PIPELINE_VB_H = 260;

const NODE_W = 140;
const NODE_H = 60;

const TRANSACTIONS_X = 30;
const STACKER_X = 580;
const FORECASTS_X = STACKER_X + NODE_W + 90;
const ROW_Y = PIPELINE_VB_H / 2;

const DOT_YS = [50, 100, 150, 200, 250].map(
  (offset) => ROW_Y + (offset - 150),
);

function PipelineFlow() {
  return (
    <div className="relative rounded-2xl border border-zinc-200 bg-gradient-to-b from-zinc-50/50 to-white p-6 md:p-10">
      <svg
        viewBox={`0 0 ${PIPELINE_VB_W} ${PIPELINE_VB_H}`}
        className="h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="lineGrad" x1="0" x2="1">
            <stop offset="0%" stopColor="#0A0A0A" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0A0A0A" stopOpacity="0.45" />
          </linearGradient>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 Z" fill="#0A0A0A" opacity="0.55" />
          </marker>
        </defs>

        <FanOut />

        <Node
          x={TRANSACTIONS_X}
          cy={ROW_Y}
          label="Transactions"
          sub="180 days"
        />

        <Node
          x={STACKER_X}
          cy={ROW_Y}
          label="Stacker"
          sub="Ridge meta"
          highlight
        />
        <Line
          from={STACKER_X + NODE_W}
          to={FORECASTS_X}
          y={ROW_Y}
        />
        <Node
          x={FORECASTS_X}
          cy={ROW_Y}
          label="forecasts.json"
          sub="14 days"
        />
      </svg>
      <div className="mt-6 grid grid-cols-2 gap-2 text-center md:grid-cols-5">
        {[
          "Prophet",
          "LightGBM",
          "ARIMA",
          "Holt-Winters",
          "Chronos",
        ].map((m) => (
          <div
            key={m}
            className="rounded border border-zinc-200 bg-white px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-700"
          >
            {m}
          </div>
        ))}
      </div>
    </div>
  );
}

function Node({
  x,
  cy,
  label,
  sub,
  highlight,
}: {
  x: number;
  cy: number;
  label: string;
  sub: string;
  highlight?: boolean;
}) {
  const w = NODE_W;
  const h = NODE_H;
  return (
    <g transform={`translate(${x}, ${cy - h / 2})`}>
      <rect
        width={w}
        height={h}
        rx="10"
        fill={highlight ? "#0A0A0A" : "#FFFFFF"}
        stroke={highlight ? "#0A0A0A" : "#D4D4D8"}
        strokeWidth="1"
      />
      <text
        x={w / 2}
        y={26}
        textAnchor="middle"
        fontFamily="var(--font-geist-mono), monospace"
        fontSize="12"
        fontWeight="500"
        fill={highlight ? "#FFFFFF" : "#0A0A0A"}
      >
        {label}
      </text>
      <text
        x={w / 2}
        y={43}
        textAnchor="middle"
        fontFamily="var(--font-geist-mono), monospace"
        fontSize="10"
        fill={highlight ? "rgba(255,255,255,0.65)" : "#71717A"}
      >
        {sub}
      </text>
    </g>
  );
}

function Line({ from, to, y }: { from: number; to: number; y: number }) {
  return (
    <line
      x1={from}
      y1={y}
      x2={to - 8}
      y2={y}
      stroke="#0A0A0A"
      strokeOpacity="0.4"
      strokeWidth="1.4"
      markerEnd="url(#arrow)"
    />
  );
}

function FanOut() {
  const sourceX = TRANSACTIONS_X + NODE_W;
  const sourceY = ROW_Y;
  const stackerInX = STACKER_X;
  return (
    <g>
      {DOT_YS.map((y, i) => (
        <path
          key={i}
          d={`M ${sourceX} ${sourceY} C ${sourceX + 120} ${sourceY}, ${stackerInX - 120} ${y}, ${stackerInX - 60} ${y} S ${stackerInX} ${sourceY}, ${stackerInX} ${sourceY}`}
          stroke="#0A0A0A"
          strokeOpacity={0.18 - i * 0.01}
          strokeWidth="1"
          fill="none"
        />
      ))}
    </g>
  );
}

