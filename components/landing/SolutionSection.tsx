"use client";

import { Compass, Eye, Radar } from "lucide-react";
import { motion } from "motion/react";
import { FadeIn } from "./FadeIn";

function ForecastViz() {
  const W = 240;
  const H = 80;
  const upper = "M 0 38 C 30 22, 60 18, 90 24 S 150 38, 180 32 S 210 24, 240 18";
  const lower = "M 0 58 C 30 50, 60 56, 90 56 S 150 70, 180 64 S 210 56, 240 50";
  const line = "M 0 48 C 30 36, 60 38, 90 40 S 150 54, 180 48 S 210 40, 240 34";
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="fc-band" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.1" />
          <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${upper} L 240 ${H} L 0 ${H} Z`} fill="url(#fc-band)" />
      <path d={`${lower} L 240 ${H} L 0 ${H} Z`} fill="hsl(var(--background))" />
      <path d={upper} fill="none" stroke="hsl(var(--border))" strokeWidth={1} strokeDasharray="3 3" />
      <path d={lower} fill="none" stroke="hsl(var(--border))" strokeWidth={1} strokeDasharray="3 3" />
      <motion.path
        d={line}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeWidth={1.5}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: "-30px" }}
        transition={{ duration: 1.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

function RadarViz() {
  return (
    <svg
      viewBox="0 0 240 80"
      preserveAspectRatio="none"
      className="h-full w-full"
      aria-hidden="true"
    >
      {[18, 30, 42].map((r, i) => (
        <circle
          key={r}
          cx={120}
          cy={42}
          r={r}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={1}
          strokeDasharray={i === 2 ? "2 4" : undefined}
        />
      ))}
      <line x1={78} x2={162} y1={42} y2={42} stroke="hsl(var(--border))" strokeWidth={1} />
      <line x1={120} x2={120} y1={0} y2={80} stroke="hsl(var(--border))" strokeWidth={1} strokeDasharray="2 4" />
      <motion.circle
        cx={148}
        cy={28}
        r={3}
        fill="hsl(var(--danger))"
        initial={{ scale: 0, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true, margin: "-30px" }}
        transition={{ duration: 0.4, delay: 0.5 }}
      />
      <motion.circle
        cx={148}
        cy={28}
        r={6}
        fill="none"
        stroke="hsl(var(--danger))"
        strokeWidth={1}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.5, 2.4, 0.5], opacity: [0.8, 0, 0.8] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
      />
    </svg>
  );
}

function CompassViz() {
  const steps = [
    { from: { x: 30, y: 50 }, to: { x: 90, y: 30 } },
    { from: { x: 90, y: 30 }, to: { x: 150, y: 55 } },
    { from: { x: 150, y: 55 }, to: { x: 210, y: 28 } },
  ];
  return (
    <svg
      viewBox="0 0 240 80"
      preserveAspectRatio="none"
      className="h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="compass-arrow"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 6 5 L 0 10 z" fill="hsl(var(--foreground))" />
        </marker>
      </defs>
      {steps.map((s, i) => (
        <g key={i}>
          <motion.line
            x1={s.from.x}
            y1={s.from.y}
            x2={s.to.x}
            y2={s.to.y}
            stroke="hsl(var(--foreground))"
            strokeWidth={1.5}
            strokeLinecap="round"
            markerEnd="url(#compass-arrow)"
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ duration: 0.5, delay: 0.3 + i * 0.25, ease: [0.22, 1, 0.36, 1] }}
          />
          <circle cx={s.from.x} cy={s.from.y} r={3} fill="hsl(var(--background))" stroke="hsl(var(--foreground))" strokeWidth={1.2} />
        </g>
      ))}
      <circle cx={210} cy={28} r={4} fill="hsl(var(--foreground))" />
    </svg>
  );
}

const features = [
  {
    icon: Eye,
    title: "Forecast",
    body: "ML predicts cash flow across every account, currency, and channel — with confidence intervals you can trust.",
    href: "#product-forecast",
    Viz: ForecastViz,
  },
  {
    icon: Radar,
    title: "Radar",
    body: "Detect liquidity gaps before they happen. Alerts fire 24 to 72 hours ahead — not after the overdraft notice.",
    href: "#product-radar",
    Viz: RadarViz,
  },
  {
    icon: Compass,
    title: "Compass",
    body: "Get specific rebalancing recommendations. One click executes the optimal transfer through the cheapest channel.",
    href: "#product-compass",
    Viz: CompassViz,
  },
];

export function SolutionSection() {
  return (
    <section id="how" className="px-6 py-16 md:px-8 md:py-20 lg:py-24">
      <FadeIn className="mx-auto max-w-3xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          The system
        </p>
        <h2 className="mt-6 text-4xl font-medium leading-[1.05] tracking-[-0.03em] md:text-5xl lg:text-6xl">
          Predict, prevent, optimize.
        </h2>
        <p className="mt-6 text-xl text-muted-foreground">
          Three engines working in real-time.
        </p>
      </FadeIn>

      <FadeIn className="relative mx-auto mt-16 max-w-6xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-8 right-8 top-[68px] hidden h-px md:block"
          style={{
            backgroundImage:
              "linear-gradient(to right, hsl(var(--border)) 50%, transparent 50%)",
            backgroundSize: "8px 1px",
          }}
        />
        <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3">
          {features.map(({ icon: Icon, title, body, href, Viz }) => (
            <a
              key={title}
              href={href}
              className="group relative flex flex-col rounded-2xl border border-zinc-200/70 bg-gradient-to-b from-background to-subtle/50 p-8 transition-all duration-300 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_8px_28px_-12px_rgba(0,0,0,0.12)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background ring-4 ring-background">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-6 text-xl font-medium tracking-tight">
                {title}
              </h3>
              <p className="mt-3 text-base leading-[1.7] text-muted-foreground">
                {body}
              </p>
              <div className="mt-6 h-20 w-full overflow-hidden rounded-lg border border-zinc-100 bg-subtle/60 p-2">
                <Viz />
              </div>
              <div className="mt-5 flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                → Learn more
              </div>
            </a>
          ))}
        </div>
      </FadeIn>
    </section>
  );
}
