import type { Transfer } from "@/types";
import { getForecastPointRaw } from "@/lib/data/forecasts";
import { formatCompact } from "@/lib/utils/format";

interface BuildContextArgs {
  accountId: string;
  liveBalance?: number;
  transfers: Transfer[];
  crisisScenarios: string[];
}

export function buildInsightContext({
  accountId,
  liveBalance,
  transfers,
  crisisScenarios,
}: BuildContextArgs): string | undefined {
  const parts: string[] = [];

  if (crisisScenarios.length) {
    parts.push(`Active crisis scenarios: ${crisisScenarios.join(", ")}.`);
  }

  if (liveBalance !== undefined) {
    const forecastToday = getForecastPointRaw(accountId, 0)?.balance;
    if (forecastToday !== undefined) {
      const diff = liveBalance - forecastToday;
      if (Math.abs(diff) > 1000) {
        const sign = diff > 0 ? "+" : "−";
        parts.push(
          `Live balance is currently ${formatCompactGeneric(liveBalance)}, which is ${sign}${formatCompactGeneric(Math.abs(diff))} versus the original ML forecast for today (${formatCompactGeneric(forecastToday)}). The forecast for the next 14 days should be adjusted by this delta.`,
        );
      }
    }
  }

  const executed = transfers.filter((t) => t.status === "completed");
  if (executed.length) {
    const lines = executed.slice(-3).map((t) => {
      const dir = t.to === accountId ? "in" : "out";
      const sign = t.to === accountId ? "+" : "−";
      const amount = formatCompact(t.amount, t.currency);
      return `${t.channel} ${dir} ${sign}${amount} (transfer id ${t.id})`;
    });
    parts.push(
      `Recently executed transfers affecting this account: ${lines.join("; ")}. Treat these as already applied to the live balance.`,
    );
  }

  return parts.length ? parts.join(" ") : undefined;
}

function formatCompactGeneric(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${Math.round(value)}`;
}
