import { create } from "zustand";

export interface InsightEntry {
  status: "idle" | "loading" | "ready" | "error";
  insight?: string;
  tokensUsed?: number | null;
  model?: string;
  generatedAt?: string;
  error?: string;
}

interface InsightsStore {
  byKey: Record<string, InsightEntry>;
  inflight: Record<string, Promise<void>>;
  fetchInsight: (
    accountId: string,
    dayOffset: number,
    opts?: { force?: boolean; context?: string },
  ) => Promise<void>;
  clear: (accountId: string, dayOffset?: number) => void;
}

function keyOf(accountId: string, dayOffset: number): string {
  return `${accountId}:${dayOffset}`;
}

export const useInsightsStore = create<InsightsStore>((set, get) => ({
  byKey: {},
  inflight: {},
  fetchInsight: async (accountId, dayOffset, opts) => {
    const key = keyOf(accountId, dayOffset);
    const state = get();
    if (!opts?.force && state.byKey[key]?.status === "ready") return;
    const existing = state.inflight[key];
    if (existing) {
      await existing;
      return;
    }
    set((s) => ({
      byKey: { ...s.byKey, [key]: { status: "loading" } },
    }));

    const promise = (async () => {
      try {
        const res = await fetch("/api/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId,
            dayOffset,
            context: opts?.context,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          set((s) => ({
            byKey: {
              ...s.byKey,
              [key]: {
                status: "error",
                error: data?.message ?? `${res.status} ${res.statusText}`,
              },
            },
          }));
          return;
        }
        set((s) => ({
          byKey: {
            ...s.byKey,
            [key]: {
              status: "ready",
              insight: data.insight,
              tokensUsed: data.tokensUsed,
              model: data.model,
              generatedAt: data.generatedAt,
            },
          },
        }));
      } catch (err) {
        set((s) => ({
          byKey: {
            ...s.byKey,
            [key]: {
              status: "error",
              error: err instanceof Error ? err.message : "Network error",
            },
          },
        }));
      } finally {
        set((s) => {
          const next = { ...s.inflight };
          delete next[key];
          return { inflight: next };
        });
      }
    })();

    set((s) => ({
      inflight: { ...s.inflight, [key]: promise },
    }));
    return promise;
  },
  clear: (accountId, dayOffset) => {
    set((s) => {
      if (dayOffset === undefined) {
        const next: Record<string, InsightEntry> = {};
        for (const [k, v] of Object.entries(s.byKey)) {
          if (!k.startsWith(`${accountId}:`)) next[k] = v;
        }
        return { byKey: next };
      }
      const next = { ...s.byKey };
      delete next[keyOf(accountId, dayOffset)];
      return { byKey: next };
    });
  },
}));

export function useInsightEntry(
  accountId: string,
  dayOffset: number,
): InsightEntry | undefined {
  return useInsightsStore((s) => s.byKey[keyOf(accountId, dayOffset)]);
}
