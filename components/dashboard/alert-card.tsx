"use client";

import { useState } from "react";
import { ArrowRight, Triangle, Circle, Info, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Alert } from "@/types";
import { useAccountsStore } from "@/lib/store/accounts-store";
import { useUiStore } from "@/lib/store/ui-store";
import { useTimeStore } from "@/lib/store/time-store";
import { useCrisisStore } from "@/lib/store/crisis-store";
import { formatPercent, formatDateTime, formatCompact } from "@/lib/utils/format";
import { AiInsightPanel } from "./ai-insight-panel";

const SEVERITY: Record<
  Alert["severity"],
  { icon: typeof Triangle; color: string }
> = {
  critical: { icon: Triangle, color: "text-red-600" },
  warning: { icon: Circle, color: "text-amber-600" },
  info: { icon: Info, color: "text-zinc-500" },
};

export function AlertCard({ alert }: { alert: Alert }) {
  const dismissAlert = useAccountsStore((s) => s.dismissAlert);
  const executeTransfer = useAccountsStore((s) => s.executeTransfer);
  const setHoveredTransfer = useUiStore((s) => s.setHoveredTransfer);
  const offset = useTimeStore((s) => s.currentOffset);
  const activeScenarios = useCrisisStore((s) => s.activeScenarios);
  const [insightOpen, setInsightOpen] = useState(false);
  const { icon: Icon, color } = SEVERITY[alert.severity];

  const recommended = alert.recommendedTransfer;

  function handleExecute() {
    if (!recommended) return;
    executeTransfer(recommended);
    toast.success("Resolved. Account back in the green.", {
      description: `${recommended.channel} transfer of ${formatCompact(recommended.amount, recommended.currency)} executed.`,
    });
  }

  const insightContext = activeScenarios.length
    ? `Active crisis scenarios: ${activeScenarios.join(", ")}.`
    : undefined;

  return (
    <article
      onMouseEnter={() =>
        recommended && setHoveredTransfer(recommended.id)
      }
      onMouseLeave={() => setHoveredTransfer(null)}
      className="group relative rounded-lg border border-zinc-200/80 bg-white p-4 transition-colors hover:border-zinc-300"
    >
      <button
        type="button"
        onClick={() => dismissAlert(alert.id)}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-700 group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>

      <div className="flex items-start gap-2.5 pr-6">
        <Icon
          className={`mt-[3px] h-3 w-3 shrink-0 ${color}`}
          fill="currentColor"
        />
        <h3 className="text-[13px] font-medium leading-snug text-zinc-900">
          {alert.title}
        </h3>
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-zinc-500">
        {alert.description}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px]">
        <div>
          <dt className="uppercase tracking-[0.12em] text-zinc-400">
            Predicted
          </dt>
          <dd className="mt-0.5 tabular-nums text-zinc-700">
            {formatDateTime(alert.predictedDate)}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.12em] text-zinc-400">
            Confidence
          </dt>
          <dd className="mt-0.5 tabular-nums text-zinc-700">
            {formatPercent(alert.confidence)}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={() => setInsightOpen((v) => !v)}
        aria-expanded={insightOpen}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-900"
      >
        <Sparkles className="h-3 w-3" />
        {insightOpen ? "Hide AI insight" : "Get AI insight"}
      </button>

      <AiInsightPanel
        accountId={alert.accountId}
        dayOffset={offset}
        context={insightContext}
        open={insightOpen}
      />

      {recommended && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleExecute}
            className="inline-flex flex-1 items-center justify-between gap-2 rounded-md bg-zinc-900 px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Execute Plan
            <ArrowRight className="h-3 w-3" />
          </button>
          <span className="font-mono text-[10px] tabular-nums text-zinc-400">
            $40 fee
          </span>
        </div>
      )}
    </article>
  );
}
