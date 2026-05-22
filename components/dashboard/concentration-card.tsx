"use client";

import { useMemo, useState } from "react";
import { useAccountsStore } from "@/lib/store/accounts-store";
import { useTimeStore } from "@/lib/store/time-store";
import { useCrisisStore } from "@/lib/store/crisis-store";
import { accountMetas } from "@/lib/data/accounts";
import { getEffectiveBalanceAt } from "@/lib/utils/forecast";
import {
  computeHHI,
  getBankRating,
  levelBg,
  levelColor,
  levelLabel,
  type AccountWithCountry,
  type ConcentrationDimension,
} from "@/lib/utils/concentration";
import { formatCompact } from "@/lib/utils/format";
import { NumberTicker } from "./number-ticker";

const DIMENSIONS: { id: ConcentrationDimension; label: string }[] = [
  { id: "bank", label: "Bank" },
  { id: "currency", label: "Currency" },
  { id: "country", label: "Country" },
];

export function ConcentrationCard() {
  const accounts = useAccountsStore((s) => s.accounts);
  const offset = useTimeStore((s) => s.currentOffset);
  const activeScenarios = useCrisisStore((s) => s.activeScenarios);
  const [dimension, setDimension] = useState<ConcentrationDimension>("bank");

  const enriched: AccountWithCountry[] = useMemo(() => {
    return accounts.map((a) => {
      const meta = accountMetas.find((m) => m.id === a.id);
      const balance =
        offset === 0 ? a.balance : getEffectiveBalanceAt(a, offset, a.balance);
      return {
        ...a,
        balance,
        country: meta?.country ?? "??",
      };
    });
    // crisis scenarios feed into getEffectiveBalanceAt → include in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, offset, activeScenarios]);

  const result = useMemo(
    () => computeHHI(enriched, dimension),
    [enriched, dimension],
  );

  const topBuckets = result.breakdown.slice(0, 5);

  return (
    <div className="rounded-lg border border-zinc-200/80 bg-white p-3">
      <div className="flex items-baseline justify-between pb-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-900">
          Concentration · HHI
        </h2>
        <span
          className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${levelBg(result.level)} ${levelColor(result.level)}`}
        >
          {levelLabel(result.level)}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="leading-tight">
          <div className="flex items-baseline gap-1">
            <span
              className={`font-mono text-[22px] font-medium tabular-nums tracking-tight transition-colors ${levelColor(result.level)}`}
            >
              <NumberTicker value={result.hhi} />
            </span>
            <span className="font-mono text-[10px] text-zinc-400">/10000</span>
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">
            Herfindahl-Hirschman
          </div>
          {dimension === "bank" && result.hhiRiskAdjusted !== result.hhi && (
            <div
              className={`mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${levelColor(result.riskAdjustedLevel)}`}
              title="Risk-adjusted HHI weights each bucket by the counterparty's credit rating multiplier."
            >
              Risk-adjusted · <NumberTicker value={result.hhiRiskAdjusted} />
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-0.5 rounded-md border border-zinc-200/80 bg-zinc-50 p-0.5">
          {DIMENSIONS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDimension(d.id)}
              aria-pressed={dimension === d.id}
              className={`rounded px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors ${
                dimension === d.id
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {topBuckets.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {topBuckets.map((b) => {
            const rating = dimension === "bank" ? getBankRating(b.key) : null;
            return (
              <div key={b.key} className="flex items-center gap-2">
                <span className="w-20 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-600">
                  {b.key}
                </span>
                {rating && (
                  <span
                    className={`rounded px-1 font-mono text-[8px] uppercase tracking-[0.08em] ${
                      rating.multiplier <= 1.0
                        ? "bg-emerald-50 text-emerald-700"
                        : rating.multiplier <= 1.15
                          ? "bg-amber-50 text-amber-700"
                          : "bg-red-50 text-red-700"
                    }`}
                    title={`Credit rating ${rating.rating}, risk multiplier ${rating.multiplier.toFixed(2)}`}
                  >
                    {rating.rating}
                  </span>
                )}
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={`h-full rounded-full ${
                      b.share >= 0.5
                        ? "bg-red-500"
                        : b.share >= 0.25
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.max(2, b.share * 100)}%` }}
                  />
                </div>
                <span className="w-10 text-right font-mono text-[10px] tabular-nums text-zinc-500">
                  {Math.round(b.share * 100)}%
                </span>
                <span className="w-12 text-right font-mono text-[10px] tabular-nums text-zinc-400">
                  {formatCompact(b.balance, "USD")}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-2 border-t border-zinc-100 pt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-400">
        DOJ scale · &lt;1500 low · 1500-2500 moderate · &gt;2500 concentrated
      </div>
    </div>
  );
}
