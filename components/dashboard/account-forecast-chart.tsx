"use client";

import { useMemo } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Account } from "@/types";
import { getAccountTrajectory } from "@/lib/utils/forecast";
import { formatCompact } from "@/lib/utils/format";

interface ChartPoint {
  dayOffset: number;
  date: string;
  balance: number;
  historical: number | null;
  predicted: number | null;
  p10: number;
  p90: number;
  band: [number, number];
  isHistorical: boolean;
}

function seedFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function syntheticTrajectory(account: Account): ChartPoint[] {
  const rand = mulberry32(seedFromId(account.id));
  const points: ChartPoint[] = [];
  const base = account.balance || account.minBalance || 100_000;
  const today = new Date();
  for (let offset = -30; offset <= 14; offset++) {
    const wave =
      Math.sin((offset + account.id.length) / 6) * base * 0.06 +
      Math.cos(offset / 4) * base * 0.03;
    const noise = (rand() - 0.5) * 0.04 * base;
    const balance = Math.max(0, Math.round(base + wave + noise));
    const isHistorical = offset <= 0;
    const uncertainty = isHistorical
      ? 0
      : Math.min(0.32, 0.04 + offset * 0.022);
    const p10 = Math.round(balance * (1 - uncertainty));
    const p90 = Math.round(balance * (1 + uncertainty));
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + offset);
    points.push({
      dayOffset: offset,
      date: d.toISOString(),
      balance,
      historical: isHistorical ? balance : null,
      predicted: !isHistorical ? balance : null,
      p10,
      p90,
      band: [p10, p90],
      isHistorical,
    });
  }
  return points;
}

interface AccountForecastChartProps {
  account: Account;
  height?: number;
}

export function AccountForecastChart({
  account,
  height = 240,
}: AccountForecastChartProps) {
  const data: ChartPoint[] = useMemo(() => {
    const trajectory = getAccountTrajectory(account.id, -30, 14);
    if (trajectory.length === 0) return syntheticTrajectory(account);
    const lastHistIdx = (() => {
      let i = -1;
      for (let k = 0; k < trajectory.length; k++) {
        if (trajectory[k].isHistorical) i = k;
      }
      return i;
    })();
    return trajectory.map((p, i) => {
      const isBridge = i === lastHistIdx;
      return {
        dayOffset: p.dayOffset,
        date: p.date,
        balance: p.balance,
        historical: p.isHistorical ? p.balance : null,
        predicted: !p.isHistorical || isBridge ? p.balance : null,
        p10: p.p10,
        p90: p.p90,
        band: [p.p10, p.p90] as [number, number],
        isHistorical: p.isHistorical,
      };
    });
  }, [account]);

  const allValues = data.flatMap((d) => [d.balance, d.p10, d.p90]);
  const yMin = Math.min(...allValues, account.minBalance) * 0.95;
  const yMax = Math.max(...allValues, account.minBalance) * 1.1;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 4, bottom: 8, left: 0 }}
        >
          <defs>
            <linearGradient id="band-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0A0A0A" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#0A0A0A" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="dayOffset"
            tick={{
              fill: "#A1A1AA",
              fontSize: 10,
              fontFamily: "var(--font-geist-mono), monospace",
            }}
            axisLine={{ stroke: "#E4E4E7" }}
            tickLine={false}
            ticks={[-30, -14, -7, 0, 7, 14]}
            tickFormatter={(v) =>
              v === 0 ? "Today" : v > 0 ? `+${v}d` : `${v}d`
            }
          />
          <YAxis
            tick={{
              fill: "#A1A1AA",
              fontSize: 10,
              fontFamily: "var(--font-geist-mono), monospace",
            }}
            axisLine={false}
            tickLine={false}
            width={56}
            domain={[yMin, yMax]}
            tickFormatter={(v) => formatCompact(v, account.currency)}
          />
          <Tooltip
            cursor={{ stroke: "#0A0A0A", strokeOpacity: 0.18, strokeWidth: 1 }}
            contentStyle={{
              background: "#FFFFFF",
              border: "1px solid #E4E4E7",
              borderRadius: 8,
              fontSize: 11,
              fontFamily: "var(--font-geist-mono), monospace",
              boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
              padding: "8px 10px",
            }}
            labelFormatter={(v) => {
              const n = Number(v);
              return n === 0 ? "Today" : n > 0 ? `+${n} days` : `${n} days ago`;
            }}
            formatter={(value, name) => {
              if (Array.isArray(value)) {
                const [lo, hi] = value as [number, number];
                return [
                  `${formatCompact(Number(lo), account.currency)} – ${formatCompact(Number(hi), account.currency)}`,
                  "P10 – P90",
                ];
              }
              const label =
                name === "historical"
                  ? "Actual"
                  : name === "predicted"
                    ? "Forecast"
                    : name === "band"
                      ? "P10 – P90"
                      : String(name);
              return [formatCompact(Number(value), account.currency), label];
            }}
          />

          <Area
            type="monotone"
            dataKey="band"
            stroke="none"
            fill="url(#band-fill)"
            isAnimationActive={false}
            connectNulls
          />

          <ReferenceLine
            y={account.minBalance}
            stroke="#DC2626"
            strokeOpacity={0.7}
            strokeDasharray="3 4"
            label={{
              value: "Min",
              position: "insideTopRight",
              fill: "#DC2626",
              fontSize: 9,
              fontFamily: "var(--font-geist-mono), monospace",
            }}
          />

          <ReferenceLine
            x={0}
            stroke="#0A0A0A"
            strokeDasharray="2 3"
            strokeOpacity={0.4}
          />

          <Line
            type="monotone"
            dataKey="historical"
            stroke="#0A0A0A"
            strokeWidth={1.8}
            dot={false}
            activeDot={{
              r: 4,
              stroke: "#FFFFFF",
              strokeWidth: 2,
              fill: "#0A0A0A",
            }}
            isAnimationActive={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="predicted"
            stroke="#2563EB"
            strokeWidth={1.6}
            strokeDasharray="4 4"
            dot={false}
            activeDot={{
              r: 4,
              stroke: "#FFFFFF",
              strokeWidth: 2,
              fill: "#2563EB",
            }}
            isAnimationActive={false}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
