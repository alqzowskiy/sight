"use client";

import { useMemo } from "react";
import { useAccountsStore } from "@/lib/store/accounts-store";
import { useTimeStore } from "@/lib/store/time-store";
import {
  getEffectiveBalanceAt,
  getEffectiveStatusAt,
} from "@/lib/utils/forecast";
import { formatCompact } from "@/lib/utils/format";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { Account } from "@/types";

interface GlobeHoverCardProps {
  location: [number, number] | null;
  x: number;
  y: number;
  containerWidth: number;
  containerHeight: number;
}

function statusMeta(status: Account["status"]) {
  switch (status) {
    case "critical":
      return { color: "#DC2626", bg: "rgba(220,38,38,0.08)", label: "Critical" };
    case "warning":
      return { color: "#B45309", bg: "rgba(245,158,11,0.08)", label: "Warning" };
    default:
      return { color: "#15803D", bg: "rgba(34,197,94,0.08)", label: "Healthy" };
  }
}

export function GlobeHoverCard({
  location,
  x,
  y,
  containerWidth,
  containerHeight,
}: GlobeHoverCardProps) {
  const accounts = useAccountsStore((s) => s.accounts);
  const transfers = useAccountsStore((s) => s.transfers);
  const offset = useTimeStore((s) => s.currentOffset);

  const data = useMemo(() => {
    if (!location) return null;
    const [lat, lng] = location;
    const matching = accounts.filter(
      (a) =>
        Math.abs(a.location[0] - lat) < 0.05 &&
        Math.abs(a.location[1] - lng) < 0.05,
    );
    if (matching.length === 0) return null;
    return matching;
  }, [accounts, location]);

  if (!location || !data) return null;

  const primary = data[0];
  const city = primary.name.split("·")[1]?.trim() ?? "";
  const balance =
    offset === 0
      ? primary.balance
      : getEffectiveBalanceAt(primary, offset, primary.balance);
  const status =
    offset === 0
      ? primary.status
      : getEffectiveStatusAt(primary, offset, primary.balance);
  const meta = statusMeta(status);

  let inflow = 0;
  let outflow = 0;
  for (const t of transfers) {
    if (t.status !== "completed") continue;
    if (t.to === primary.id) inflow += t.amount;
    if (t.from === primary.id) outflow += t.amount;
  }

  const CARD_W = 240;
  const CARD_H = data.length > 1 ? 200 : 180;
  const PAD = 12;
  let left = x + 16;
  let top = y - CARD_H / 2;
  if (left + CARD_W + PAD > containerWidth) {
    left = x - 16 - CARD_W;
  }
  if (top < PAD) top = PAD;
  if (top + CARD_H + PAD > containerHeight) {
    top = containerHeight - CARD_H - PAD;
  }

  return (
    <div
      className="pointer-events-none absolute z-30"
      style={{
        left,
        top,
        width: CARD_W,
        transform: "translateZ(0)",
        animation: "sg-hovercard-in 140ms ease-out",
      }}
    >
      <style>{`@keyframes sg-hovercard-in { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div className="rounded-md border border-zinc-200 bg-white/98 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] backdrop-blur-sm">
        <div className="flex items-start justify-between gap-2 px-3 pt-2.5">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-900">
              {primary.currency} · {city || primary.bank}
            </div>
            <div className="mt-0.5 truncate text-[10.5px] text-zinc-500">
              {primary.bank}
            </div>
          </div>
          <span
            className="shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em]"
            style={{ color: meta.color, background: meta.bg }}
          >
            {meta.label}
          </span>
        </div>
        <div className="px-3 pt-2">
          <div className="font-mono text-[15px] tabular-nums text-zinc-900">
            {formatCompact(balance, primary.currency)}
          </div>
          {primary.minBalance > 0 && (
            <div className="mt-0.5 font-mono text-[9.5px] text-zinc-500">
              min {formatCompact(primary.minBalance, primary.currency)}
            </div>
          )}
        </div>
        <div className="mt-2 border-t border-zinc-100 px-3 py-2">
          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-400">
            Activity (session)
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-2 font-mono text-[10.5px] tabular-nums">
            <div className="flex items-center gap-1.5 text-zinc-700">
              <ArrowDownLeft className="h-3 w-3 text-emerald-600" strokeWidth={1.7} />
              <span>{formatCompact(inflow, primary.currency)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-700">
              <ArrowUpRight className="h-3 w-3 text-rose-600" strokeWidth={1.7} />
              <span>{formatCompact(outflow, primary.currency)}</span>
            </div>
          </div>
        </div>
        {data.length > 1 && (
          <div className="border-t border-zinc-100 px-3 py-2 font-mono text-[9.5px] text-zinc-500">
            +{data.length - 1} other account{data.length - 1 === 1 ? "" : "s"} at this location
          </div>
        )}
      </div>
    </div>
  );
}
