"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle } from "lucide-react";

const sparkPoints = [42, 44, 43, 46, 48, 45, 47, 49, 47, 48, 50, 52, 51, 53];
const forecastBars = [1, 2, 3, 6, 9, 12, 8, 5, 3]; // tailwind h-* steps

function buildSpark(values: number[], w: number, h: number) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function formatBalance(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function LiveWidget() {
  const [balance, setBalance] = useState(4237418.22);

  useEffect(() => {
    const id = setInterval(() => {
      setBalance((b) => {
        const delta = (Math.random() - 0.45) * 320;
        return Math.max(0, b + delta);
      });
    }, 4200);
    return () => clearInterval(id);
  }, []);

  const sparkPath = buildSpark(sparkPoints, 320, 56);

  return (
    <div className="relative rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-white shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          <span className="font-mono text-[12px] text-white">USD-NYC</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            · JPM
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-success">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          Live
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-4">
        <span className="font-mono text-[28px] font-medium leading-none tracking-tight md:text-[32px]">
          ${formatBalance(balance)}
        </span>
        <span className="font-mono text-[11px] text-success">+2.4%</span>
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
        24h net flow
      </div>

      <svg
        viewBox="0 0 320 56"
        preserveAspectRatio="none"
        className="mt-5 h-14 w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="widget-spark" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <motion.path
          d={`${sparkPath} L 320 56 L 0 56 Z`}
          fill="url(#widget-spark)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        />
        <motion.path
          d={sparkPath}
          fill="none"
          stroke="white"
          strokeWidth={1.5}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>

      <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none text-warning" />
          <div className="flex-1">
            <div className="text-[13px] font-medium text-white">
              Predicted gap · Friday 14:00
            </div>
            <div className="mt-1 flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
              <span>Confidence 87%</span>
              <span className="text-warning">Action ready</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-end justify-between gap-1.5">
          {forecastBars.map((h, i) => {
            const danger = h <= 3;
            return (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${h * 4 + 4}px` }}
                transition={{
                  duration: 0.6,
                  delay: 1.0 + i * 0.06,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={`flex-1 rounded-sm ${
                  danger ? "bg-danger/80" : "bg-white/40"
                }`}
              />
            );
          })}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[9px] uppercase tracking-wider text-zinc-500">
          {["M", "T", "W", "T", "F", "S", "S", "M", "T"].map((d, i) => (
            <span key={i} className="flex-1 text-center">
              {d}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
