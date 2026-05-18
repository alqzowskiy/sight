"use client";

import { motion } from "motion/react";
import type { BaseModel } from "@/lib/data/ensemble";

const ACCENT = "#2563EB";
const INK = "#0A0A0A";
const MUTED = "#A1A1AA";
const FAINT = "#E4E4E7";

interface Props {
  active: boolean;
}

export function ModelIllustration({
  model,
  active,
}: {
  model: BaseModel;
  active: boolean;
}) {
  switch (model) {
    case "prophet":
      return <ProphetArt active={active} />;
    case "lightgbm":
      return <LightGBMArt active={active} />;
    case "arima":
      return <ArimaArt active={active} />;
    case "ets":
      return <EtsArt active={active} />;
    case "chronos":
      return <ChronosArt active={active} />;
  }
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 200 90"
      className="h-[88px] w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {children}
    </svg>
  );
}

function ProphetArt({ active }: Props) {
  const wave = "M 0 60 Q 20 30, 40 60 T 80 60 T 120 60 T 160 60 T 200 60";
  const trend = "M 0 70 L 200 30";
  return (
    <Frame>
      <line x1="0" y1="80" x2="200" y2="80" stroke={FAINT} strokeWidth="1" />
      <motion.path
        d={trend}
        stroke={MUTED}
        strokeWidth="1"
        strokeDasharray="3 3"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.0, delay: 0.05 }}
      />
      <motion.path
        d={wave}
        stroke={active ? ACCENT : INK}
        strokeWidth="1.6"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, delay: 0.15 }}
      />
      {[40, 100, 160].map((x, i) => (
        <motion.g
          key={x}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.6 + i * 0.1 }}
        >
          <line
            x1={x}
            y1="80"
            x2={x}
            y2="65"
            stroke={ACCENT}
            strokeOpacity="0.4"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <circle cx={x} cy="63" r="2.5" fill={ACCENT} />
        </motion.g>
      ))}
      <text
        x="2"
        y="12"
        fontSize="7"
        fontFamily="var(--font-geist-mono), monospace"
        fill={MUTED}
        letterSpacing="0.5"
      >
        TREND + SEASONALITY
      </text>
    </Frame>
  );
}

function LightGBMArt({ active }: Props) {
  const stroke = active ? ACCENT : INK;
  const nodes = [
    { id: "r", x: 100, y: 20 },
    { id: "l", x: 60, y: 50 },
    { id: "rr", x: 140, y: 50 },
    { id: "ll", x: 35, y: 78 },
    { id: "lr", x: 80, y: 78 },
    { id: "rl", x: 120, y: 78 },
    { id: "rrr", x: 165, y: 78 },
  ];
  const edges: Array<[string, string]> = [
    ["r", "l"],
    ["r", "rr"],
    ["l", "ll"],
    ["l", "lr"],
    ["rr", "rl"],
    ["rr", "rrr"],
  ];
  const get = (id: string) => nodes.find((n) => n.id === id)!;
  return (
    <Frame>
      {edges.map(([a, b], i) => {
        const na = get(a);
        const nb = get(b);
        return (
          <motion.line
            key={`${a}-${b}`}
            x1={na.x}
            y1={na.y}
            x2={nb.x}
            y2={nb.y}
            stroke={stroke}
            strokeOpacity={0.4}
            strokeWidth="1"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.1 + i * 0.06 }}
          />
        );
      })}
      {nodes.map((n, i) => (
        <motion.circle
          key={n.id}
          cx={n.x}
          cy={n.y}
          r={n.id === "r" ? 4 : 3}
          fill={n.id === "r" ? stroke : "white"}
          stroke={stroke}
          strokeWidth="1.4"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 + i * 0.05 }}
        />
      ))}
      <text
        x="2"
        y="12"
        fontSize="7"
        fontFamily="var(--font-geist-mono), monospace"
        fill={MUTED}
        letterSpacing="0.5"
      >
        QUANTILE TREES · P10 / P50 / P90
      </text>
    </Frame>
  );
}

function ArimaArt({ active }: Props) {
  const stroke = active ? ACCENT : INK;
  const heights = [42, 14, 28, 8, 32, 12, 6, 18, 4, 10, 8, 4];
  return (
    <Frame>
      <line x1="6" y1="80" x2="200" y2="80" stroke={FAINT} strokeWidth="1" />
      <line
        x1="6"
        y1="80"
        x2="6"
        y2="30"
        stroke={FAINT}
        strokeWidth="1"
      />
      {[35, 55].map((y) => (
        <line
          key={y}
          x1="6"
          x2="200"
          y1={y}
          y2={y}
          stroke={FAINT}
          strokeOpacity="0.6"
          strokeWidth="0.5"
          strokeDasharray="2 3"
        />
      ))}
      {heights.map((h, i) => {
        const x = 14 + i * 15;
        return (
          <motion.rect
            key={i}
            x={x - 4}
            y={80 - h}
            width="6"
            height={h}
            fill={i === 0 || i === 4 ? stroke : MUTED}
            opacity={i === 0 || i === 4 ? 1 : 0.5}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.4, delay: 0.15 + i * 0.04 }}
            style={{ transformOrigin: `${x - 1}px 80px` }}
          />
        );
      })}
      <text
        x="2"
        y="12"
        fontSize="7"
        fontFamily="var(--font-geist-mono), monospace"
        fill={MUTED}
        letterSpacing="0.5"
      >
        AUTOCORRELATION · LAG 1, 7
      </text>
    </Frame>
  );
}

function EtsArt({ active }: Props) {
  const stroke = active ? ACCENT : INK;
  const raw =
    "M 0 60 L 12 42 L 24 65 L 36 38 L 48 58 L 60 30 L 72 55 L 84 40 L 96 50 L 108 28 L 120 48 L 132 32 L 144 44 L 156 22 L 168 40 L 180 28 L 192 36 L 200 24";
  const smooth = "M 0 58 Q 50 40, 100 38 T 200 26";
  return (
    <Frame>
      <line x1="0" y1="80" x2="200" y2="80" stroke={FAINT} strokeWidth="1" />
      <motion.path
        d={raw}
        stroke={MUTED}
        strokeOpacity="0.55"
        strokeWidth="1"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.0, delay: 0.1 }}
      />
      <motion.path
        d={smooth}
        stroke={stroke}
        strokeWidth="1.8"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, delay: 0.3 }}
      />
      <motion.circle
        cx="200"
        cy="26"
        r="2.5"
        fill={stroke}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3, delay: 1.4 }}
      />
      <text
        x="2"
        y="12"
        fontSize="7"
        fontFamily="var(--font-geist-mono), monospace"
        fill={MUTED}
        letterSpacing="0.5"
      >
        SMOOTHED · ERROR / TREND / SEASON
      </text>
    </Frame>
  );
}

function ChronosArt({ active }: Props) {
  const stroke = active ? ACCENT : INK;
  const cols = 14;
  const rows = 3;
  const cellW = 12;
  const cellH = 10;
  const startX = 16;
  const startY = 36;
  const attention: Array<[number, number]> = [
    [2, 9],
    [4, 11],
    [6, 12],
    [1, 10],
  ];
  return (
    <Frame>
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => {
          const isLit = (c + r * 3) % 5 === 0 || (c === 13 && r === 1);
          const x = startX + c * cellW;
          const y = startY + r * cellH;
          return (
            <motion.rect
              key={`${r}-${c}`}
              x={x}
              y={y}
              width={cellW - 2}
              height={cellH - 2}
              fill={isLit ? stroke : "white"}
              stroke={isLit ? stroke : FAINT}
              strokeWidth="0.8"
              opacity={isLit ? 0.85 : 1}
              initial={{ opacity: 0 }}
              animate={{ opacity: isLit ? 0.85 : 1 }}
              transition={{
                duration: 0.25,
                delay: 0.05 + (r * cols + c) * 0.012,
              }}
            />
          );
        }),
      )}
      {attention.map(([a, b], i) => {
        const x1 = startX + a * cellW + cellW / 2 - 1;
        const x2 = startX + b * cellW + cellW / 2 - 1;
        const y = startY - 2;
        const d = `M ${x1} ${y} Q ${(x1 + x2) / 2} ${y - 18}, ${x2} ${y}`;
        return (
          <motion.path
            key={i}
            d={d}
            stroke={stroke}
            strokeWidth="1"
            fill="none"
            strokeOpacity="0.55"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: 0.6 + i * 0.1 }}
          />
        );
      })}
      <text
        x="2"
        y="12"
        fontSize="7"
        fontFamily="var(--font-geist-mono), monospace"
        fill={MUTED}
        letterSpacing="0.5"
      >
        T5 TOKENS · ATTENTION
      </text>
    </Frame>
  );
}

