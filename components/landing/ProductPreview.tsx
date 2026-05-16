"use client";

import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Bell } from "lucide-react";

const forecast = [
  { d: "Mon", v: 32 },
  { d: "Tue", v: 41 },
  { d: "Wed", v: 28 },
  { d: "Thu", v: 19 },
  { d: "Fri", v: 8 },
  { d: "Sat", v: 14 },
  { d: "Sun", v: 22 },
];

const upper = [38, 47, 35, 27, 18, 22, 31];
const lower = [26, 33, 21, 11, -2, 6, 13];

function buildPath(values: number[], width: number, height: number) {
  const min = -5;
  const max = 50;
  const step = width / (values.length - 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / (max - min)) * height;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildArea(
  upperVals: number[],
  lowerVals: number[],
  width: number,
  height: number
) {
  const min = -5;
  const max = 50;
  const step = width / (upperVals.length - 1);
  const top = upperVals
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / (max - min)) * height;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const bottom = lowerVals
    .slice()
    .reverse()
    .map((v, i) => {
      const x = (lowerVals.length - 1 - i) * step;
      const y = height - ((v - min) / (max - min)) * height;
      return `L ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return `${top} ${bottom} Z`;
}

const W = 720;
const H = 220;
const linePath = buildPath(
  forecast.map((p) => p.v),
  W,
  H
);
const areaPath = buildArea(upper, lower, W, H);
const zeroY = H - ((0 - -5) / (50 - -5)) * H;

export function ProductPreview() {
  return (
    <div className="relative h-full w-full p-6 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-1.5 w-1.5">
              <motion.span
                className="absolute inset-0 rounded-full bg-success"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Live · Liquidity forecast · 7 days
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="font-mono text-3xl font-medium tracking-tight md:text-4xl">
              $42.8M
            </span>
            <span className="inline-flex items-center gap-0.5 font-mono text-xs text-success">
              <ArrowUpRight className="h-3 w-3" />
              +3.2%
            </span>
          </div>
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">
            Projected net position · P50 confidence
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-md border border-zinc-200 bg-background px-2.5 py-1.5 md:flex">
          <Bell className="h-3 w-3 text-warning" />
          <div className="text-[11px]">
            <span className="font-medium">EUR overdraft risk</span>
            <span className="ml-1 text-muted-foreground">in 3 days</span>
          </div>
        </div>
      </div>

      <div className="relative mt-6">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-[180px] w-full md:h-[220px]"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="forecast-band" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.08" />
              <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((p) => (
            <line
              key={p}
              x1={0}
              x2={W}
              y1={H * p}
              y2={H * p}
              stroke="hsl(var(--border))"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          ))}
          <line
            x1={0}
            x2={W}
            y1={zeroY}
            y2={zeroY}
            stroke="hsl(var(--danger))"
            strokeOpacity="0.35"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <motion.path
            d={areaPath}
            fill="url(#forecast-band)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          />
          <motion.path
            d={linePath}
            fill="none"
            stroke="hsl(var(--foreground))"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          />
          {forecast.map((p, i) => {
            const x = (i / (forecast.length - 1)) * W;
            const y = H - ((p.v - -5) / (50 - -5)) * H;
            const isRisk = p.v < 10;
            return (
              <motion.circle
                key={p.d}
                cx={x}
                cy={y}
                r={isRisk ? 4 : 3}
                fill={isRisk ? "hsl(var(--danger))" : "hsl(var(--foreground))"}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 1.6 + i * 0.05 }}
              />
            );
          })}
        </svg>
        <div className="mt-3 flex justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {forecast.map((p) => (
            <span key={p.d}>{p.d}</span>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 md:gap-4">
        {[
          { label: "USD · JPM", v: "$18.4M", delta: "+1.2%", up: true },
          { label: "EUR · BNP", v: "€9.1M", delta: "−5.7%", up: false },
          { label: "GBP · HSBC", v: "£6.2M", delta: "+0.8%", up: true },
        ].map((acc) => (
          <div
            key={acc.label}
            className="rounded-lg border border-zinc-200 bg-background/60 p-3 backdrop-blur-sm"
          >
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {acc.label}
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="font-mono text-base font-medium tracking-tight md:text-lg">
                {acc.v}
              </span>
              <span
                className={`inline-flex items-center gap-0.5 font-mono text-[10px] ${
                  acc.up ? "text-success" : "text-danger"
                }`}
              >
                {acc.up ? (
                  <ArrowUpRight className="h-2.5 w-2.5" />
                ) : (
                  <ArrowDownRight className="h-2.5 w-2.5" />
                )}
                {acc.delta}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
