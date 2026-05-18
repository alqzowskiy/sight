"use client";

import { useMemo } from "react";
import { useAccountsStore } from "@/lib/store/accounts-store";
import { useTimeStore } from "@/lib/store/time-store";
import { useCrisisStore } from "@/lib/store/crisis-store";
import { liquidityScore } from "@/lib/utils/scoring";
import { NumberTicker } from "./number-ticker";

function toneFor(score: number) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function trackFor(score: number) {
  if (score >= 80) return "stroke-emerald-500";
  if (score >= 50) return "stroke-amber-500";
  return "stroke-red-500";
}

export function LiquidityScore() {
  const accounts = useAccountsStore((s) => s.accounts);
  const offset = useTimeStore((s) => s.currentOffset);
  const activeScenarios = useCrisisStore((s) => s.activeScenarios);
  const score = useMemo(
    () => liquidityScore(accounts, offset),
    [accounts, offset, activeScenarios],
  );

  const size = 40;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (score / 100);

  return (
    <div className="flex items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-zinc-200"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            className={trackFor(score)}
            strokeDasharray={`${dash} ${c}`}
            style={{ transition: "stroke-dasharray 500ms ease, stroke 400ms ease" }}
          />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="flex items-baseline gap-1">
          <span
            className={`font-mono text-[22px] font-medium tabular-nums tracking-tight transition-colors ${toneFor(score)}`}
          >
            <NumberTicker value={score} />
          </span>
          <span className="font-mono text-[11px] text-zinc-400">/100</span>
        </div>
        <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">
          Liquidity Health
        </div>
      </div>
    </div>
  );
}
