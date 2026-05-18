"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, RotateCw, AlertCircle } from "lucide-react";
import {
  useInsightEntry,
  useInsightsStore,
} from "@/lib/store/insights-store";

interface AiInsightPanelProps {
  accountId: string;
  dayOffset: number;
  context?: string;
  open: boolean;
}

export function AiInsightPanel({
  accountId,
  dayOffset,
  context,
  open,
}: AiInsightPanelProps) {
  const entry = useInsightEntry(accountId, dayOffset);
  const fetchInsight = useInsightsStore((s) => s.fetchInsight);

  useEffect(() => {
    if (!open) return;
    if (!entry || entry.status === "idle") {
      void fetchInsight(accountId, dayOffset, { context });
    }
  }, [open, accountId, dayOffset, context, entry, fetchInsight]);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden"
        >
          <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white">
                  <Sparkles className="h-2.5 w-2.5" />
                  AI
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                  Sight Insight
                </span>
              </div>
              <button
                type="button"
                aria-label="Regenerate"
                disabled={entry?.status === "loading"}
                onClick={() =>
                  fetchInsight(accountId, dayOffset, {
                    force: true,
                    context,
                  })
                }
                className="rounded p-1 text-zinc-400 transition-colors hover:bg-white hover:text-zinc-700 disabled:opacity-40"
              >
                <RotateCw
                  className={`h-3 w-3 ${entry?.status === "loading" ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            <InsightBody entry={entry} />

            {entry?.status === "ready" && (
              <div className="mt-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-400">
                <span>
                  Generated · {entry.model ?? "gpt-4o-mini"}
                </span>
                {entry.tokensUsed != null && (
                  <span>{entry.tokensUsed} tokens</span>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function InsightBody({ entry }: { entry: ReturnType<typeof useInsightEntry> }) {
  if (!entry || entry.status === "loading") {
    return (
      <div className="space-y-1.5">
        <div className="h-3 w-[92%] animate-pulse rounded bg-zinc-200/70" />
        <div className="h-3 w-[78%] animate-pulse rounded bg-zinc-200/70" />
        <div className="h-3 w-[60%] animate-pulse rounded bg-zinc-200/70" />
      </div>
    );
  }
  if (entry.status === "error") {
    return (
      <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50/80 p-2 text-[11px] text-amber-900">
        <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
        <span>{entry.error ?? "Failed to fetch insight."}</span>
      </div>
    );
  }
  if (entry.status === "ready" && entry.insight) {
    return (
      <p className="text-[12px] leading-relaxed text-zinc-800">
        {entry.insight}
      </p>
    );
  }
  return null;
}
