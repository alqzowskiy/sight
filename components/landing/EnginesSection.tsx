"use client";

import { motion } from "motion/react";
import { Check } from "lucide-react";
import { FadeIn } from "./FadeIn";

type EngineProps = {
  index: string;
  title: string;
  subtitle: string;
  body: string;
  bullets: string[];
  visualOnRight?: boolean;
  Viz: React.ComponentType;
};

function ForecastViz() {
  const W = 520;
  const H = 280;
  const nowX = W / 2;
  const histLine = "M 0 180 L 60 168 L 120 175 L 180 150 L 240 140 L 260 138";
  const forecastLine = "M 260 138 L 320 122 L 380 130 L 440 110 L 520 92";
  const upperBand = "M 260 110 L 320 92 L 380 88 L 440 60 L 520 40";
  const lowerBand = "M 260 168 L 320 160 L 380 175 L 440 165 L 520 160";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="fc-band-light" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(10,10,10,0.10)" />
          <stop offset="100%" stopColor="rgba(10,10,10,0)" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((p) => (
        <line
          key={p}
          x1={0}
          x2={W}
          y1={H * p}
          y2={H * p}
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={1}
          strokeDasharray="3 4"
        />
      ))}
      <line
        x1={nowX}
        x2={nowX}
        y1={0}
        y2={H}
        stroke="rgba(0,0,0,0.2)"
        strokeWidth={1}
      />
      <text x={nowX + 6} y={18} className="font-mono" fontSize="10" fill="#737373">
        NOW
      </text>

      <path
        d={`${upperBand} L 520 ${H} L 260 ${H} Z`}
        fill="url(#fc-band-light)"
      />

      <motion.path
        d={histLine}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeWidth={1.8}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.path
        d={forecastLine}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeDasharray="4 4"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1.2, delay: 1.4, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.path
        d={upperBand}
        fill="none"
        stroke="rgba(0,0,0,0.25)"
        strokeWidth={1}
        strokeDasharray="3 3"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1.2, delay: 1.4 }}
      />
      <motion.path
        d={lowerBand}
        fill="none"
        stroke="rgba(0,0,0,0.25)"
        strokeWidth={1}
        strokeDasharray="3 3"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1.2, delay: 1.4 }}
      />

      <text x={524} y={44} fontSize="10" className="font-mono" fill="#737373" textAnchor="end">
        P90
      </text>
      <text x={524} y={164} fontSize="10" className="font-mono" fill="#737373" textAnchor="end">
        P10
      </text>
    </svg>
  );
}

function RadarViz() {
  const cx = 260;
  const cy = 140;
  const dots = [
    { x: 100, y: 80, label: "EUR-BNP", risk: false },
    { x: 350, y: 90, label: "ACH backlog", risk: false },
    { x: 420, y: 200, label: "Friday gap", risk: true },
    { x: 180, y: 220, label: "FX drift", risk: false },
    { x: 290, y: 60, label: "Holiday cal", risk: false },
  ];
  return (
    <svg
      viewBox="0 0 520 280"
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      aria-hidden="true"
    >
      {[40, 80, 120, 160].map((r, i) => (
        <circle
          key={r}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(0,0,0,0.12)"
          strokeWidth={1}
          strokeDasharray={i === 3 ? "3 4" : undefined}
        />
      ))}
      <line x1={cx - 170} x2={cx + 170} y1={cy} y2={cy} stroke="rgba(0,0,0,0.1)" />
      <line x1={cx} x2={cx} y1={cy - 170} y2={cy + 170} stroke="rgba(0,0,0,0.1)" />

      {dots.map((d, i) => (
        <g key={i}>
          {d.risk && (
            <motion.circle
              cx={d.x}
              cy={d.y}
              r={8}
              fill="none"
              stroke="hsl(var(--danger))"
              strokeWidth={1}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [0.5, 2.4, 0.5], opacity: [0.9, 0, 0.9] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
              style={{ transformOrigin: `${d.x}px ${d.y}px` }}
            />
          )}
          <circle
            cx={d.x}
            cy={d.y}
            r={d.risk ? 4 : 3}
            fill={d.risk ? "hsl(var(--danger))" : "hsl(var(--foreground))"}
          />
          <text
            x={d.x + 8}
            y={d.y + 4}
            fontSize="10"
            className="font-mono"
            fill="#525252"
          >
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function CompassViz() {
  return (
    <svg
      viewBox="0 0 520 280"
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="engine-arrow"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 6 5 L 0 10 z" fill="currentColor" />
        </marker>
      </defs>
      <rect
        x={20}
        y={120}
        width={150}
        height={40}
        rx={8}
        fill="white"
        stroke="rgba(0,0,0,0.2)"
      />
      <text x={95} y={140} textAnchor="middle" fontSize="11" className="font-mono" fill="#0a0a0a">
        Detected
      </text>
      <text x={95} y={154} textAnchor="middle" fontSize="9" className="font-mono" fill="#737373">
        EUR-BNP · Fri 14:00
      </text>

      {[
        { x: 280, y: 60, label: "SEPA · $40", best: false },
        { x: 280, y: 140, label: "SEPA Inst · $40", best: true },
        { x: 280, y: 220, label: "SWIFT · $180", best: false },
      ].map((opt, i) => (
        <g key={i} className={opt.best ? "text-foreground" : "text-zinc-400"}>
          <line
            x1={170}
            y1={140}
            x2={280}
            y2={opt.y + 16}
            stroke={opt.best ? "rgba(0,0,0,0.9)" : "rgba(0,0,0,0.25)"}
            strokeWidth={opt.best ? 1.5 : 1}
            strokeDasharray={opt.best ? undefined : "4 4"}
            markerEnd="url(#engine-arrow)"
          />
          <rect
            x={280}
            y={opt.y}
            width={170}
            height={32}
            rx={6}
            fill={opt.best ? "rgb(10,10,10)" : "white"}
            stroke={opt.best ? "rgb(10,10,10)" : "rgba(0,0,0,0.2)"}
          />
          <text
            x={365}
            y={opt.y + 20}
            textAnchor="middle"
            fontSize="10"
            className="font-mono"
            fill={opt.best ? "white" : "#737373"}
          >
            {opt.label}
          </text>
        </g>
      ))}

      <text x={460} y={110} fontSize="10" className="font-mono" fill="hsl(var(--success))">
        ✓ optimal
      </text>
    </svg>
  );
}

function EngineBlock({
  index,
  title,
  subtitle,
  body,
  bullets,
  visualOnRight = true,
  Viz,
}: EngineProps) {
  const vizFirst = !visualOnRight;
  return (
    <FadeIn>
      <div className="grid grid-cols-12 gap-6 rounded-3xl border border-zinc-200/80 bg-subtle/40 p-6 md:gap-10 md:p-8 lg:p-10">
        <div
          className={`col-span-12 md:col-span-7 ${vizFirst ? "md:order-1" : "md:order-2"}`}
        >
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-zinc-200 bg-background p-6">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
            <div className="relative h-full w-full">
              <Viz />
            </div>
          </div>
        </div>
        <div
          className={`col-span-12 flex flex-col justify-center md:col-span-5 ${vizFirst ? "md:order-2" : "md:order-1"}`}
        >
          <div className="font-mono text-[13px] tracking-wider text-muted-foreground">
            {index}
          </div>
          <h3
            className="mt-2 font-medium tracking-tight"
            style={{ fontSize: "clamp(26px, 2.8vw, 40px)", lineHeight: 1.1 }}
          >
            {title}
          </h3>
          <p className="mt-2 text-[14px] text-zinc-500">{subtitle}</p>
          <p className="mt-5 text-[15px] leading-[1.65] text-zinc-700">{body}</p>
          <ul className="mt-5 space-y-2">
            {bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-2.5 font-mono text-[13px] text-zinc-700"
              >
                <Check className="mt-0.5 h-3.5 w-3.5 flex-none text-success" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </FadeIn>
  );
}

export function EnginesSection() {
  return (
    <section
      id="engines"
      className="scroll-mt-24 px-6 py-16 md:px-10 md:py-20 lg:px-16 lg:py-24"
    >
      <div className="mx-auto max-w-[1280px]">
        <FadeIn>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            The system
          </p>
          <h2
            className="mt-5 max-w-[720px] font-medium leading-[1.05] tracking-[-0.035em]"
            style={{ fontSize: "clamp(32px, 4vw, 60px)" }}
          >
            Three engines. One intelligent system.
          </h2>
          <p
            className="mt-5 max-w-[580px] text-zinc-600"
            style={{ fontSize: "clamp(16px, 1.3vw, 19px)", lineHeight: 1.6 }}
          >
            Forecast sees ahead. Radar detects gaps. Compass tells you exactly
            what to do.
          </p>
        </FadeIn>

        <div className="mt-12 space-y-8 md:mt-16 md:space-y-10">
          <EngineBlock
            index="01 / Engine"
            title="Forecast"
            subtitle="Probabilistic cash flow prediction, 1–14 days ahead."
            body="Built on ensemble ML models trained on 6+ months of your transaction history. We don't give you a single number — we give you a distribution: P50, P90, P99. You plan for what's likely, prepare for what's possible, defend against what's catastrophic."
            bullets={[
              "1-day MAPE under 8%",
              "Multi-currency · 15 currencies live",
              "Channel-aware · SEPA, SWIFT, ACH, Visa, MC",
              "Holiday and bank-calendar aware",
            ]}
            visualOnRight={false}
            Viz={ForecastViz}
          />
          <EngineBlock
            index="02 / Engine"
            title="Radar"
            subtitle="Predictive alerts, 24–72 hours ahead."
            body="Sight watches every account, every rail, every exposure — and fires an alert before a deficit, congestion, or policy breach lands on your team. You see the problem when you can still solve it cheaply."
            bullets={[
              "Account-level deficit detection",
              "Channel congestion · settlement risk",
              "FX exposure spikes vs. policy",
              "Regulatory ratio breaches (LCR, NSFR)",
            ]}
            visualOnRight
            Viz={RadarViz}
          />
          <EngineBlock
            index="03 / Engine"
            title="Compass"
            subtitle="Optimal action, one click away."
            body="Every alert ships with a prescribed action — not a vague suggestion. Sight picks the cheapest channel, FX-routes around bad rates, and explains the reasoning. One click executes via your banking APIs."
            bullets={[
              "Cheapest channel auto-selected",
              "FX-aware routing across rails",
              "Cost-minimized transfers",
              "Audit log + SHAP-based reasoning",
            ]}
            visualOnRight={false}
            Viz={CompassViz}
          />
        </div>
      </div>
    </section>
  );
}
