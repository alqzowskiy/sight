/**
 * Sight Auto-Tour — deterministic 60-second guided demo.
 *
 * Unlike the kiosk-loop DemoMode (which cycles every 62 seconds), the
 * Auto-Tour is a single hand-rehearsed sequence designed for live pitches.
 * Steps trigger global actions (crisis activation, time machine, chat panel
 * open) on a fixed timeline. Each step has a label that's shown in the
 * progress overlay so judges can follow what's happening.
 *
 * Pacing principles:
 *   - First 10 seconds set the scene (overview).
 *   - Middle 30 seconds are the wow-features (counterparty cascade + chat).
 *   - Last 20 seconds resolve to a healthy state and call out attestation.
 *
 * Steps run regardless of OPENAI_API_KEY — chat step is best-effort and
 * the tour continues even if the API returns 503.
 */

export interface TourStep {
  /** Milliseconds from tour start when this step fires. */
  at: number;
  /** Short label shown in the progress overlay during this step. */
  label: string;
  /** Optional sub-label (smaller text, e.g., the "why"). */
  sub?: string;
  /** Action to perform. Receives an enqueue callback for nested timers. */
  action: (ctx: TourContext) => void;
}

export interface TourContext {
  /** Push a timeout id so the tour cleanup can clear it on stop. */
  enqueue: (id: number) => void;
  /** Convenience helpers to grab Zustand stores without circular imports. */
  stores: TourStores;
  /** Toast utility (sonner) — passed in to avoid pulling the import here. */
  toast: TourToast;
}

export interface TourStores {
  accounts: {
    reset: () => void;
    executeTransfer: (t: unknown) => boolean;
    addAndExecuteTransfer: (spec: unknown) => string | null;
    fetchFromApi?: () => Promise<void>;
  };
  time: {
    reset: () => void;
    setOffset: (n: number) => void;
    getOffset: () => number;
  };
  crisis: {
    clearAll: () => void;
    setOpen: (open: boolean) => void;
    activateCounterparty: (config: {
      bank: string;
      recoveryDays: number;
      label?: string;
    }) => void;
    deactivateCounterparty: () => void;
  };
  ui: {
    setChatOpen: (open: boolean) => void;
    setSelectedAccount: (id: string | null) => void;
    setCommandPaletteOpen: (open: boolean) => void;
  };
}

export interface TourToast {
  info: (text: string, opts?: { duration?: number }) => void;
  success: (text: string) => void;
}

export const TOUR_DURATION_MS = 60_000;

/**
 * The actual script. Order matters — each entry's `at` is the start time.
 * The progress overlay reads from the highest-numbered step whose `at` has
 * passed.
 */
export const TOUR_SCRIPT: TourStep[] = [
  {
    at: 0,
    label: "Welcome to Sight",
    sub: "AI Co-pilot for treasury liquidity",
    action: ({ stores, toast }) => {
      stores.accounts.reset();
      stores.time.reset();
      stores.crisis.clearAll();
      stores.crisis.setOpen(false);
      stores.ui.setChatOpen(false);
      toast.info("Sight — AI Co-pilot for treasury liquidity");
    },
  },
  {
    at: 4_000,
    label: "Live portfolio",
    sub: "11 accounts, 5 currencies, real DB-backed state",
    action: ({ toast }) => {
      toast.info("11 accounts in Postgres · state persists across reloads");
    },
  },
  {
    at: 9_000,
    label: "Concentration risk",
    sub: "Herfindahl-Hirschman by bank — Deutsche at 57%",
    action: ({ toast }) => {
      toast.info(
        "HHI by bank: 3680 (high). Top counterparty Deutsche Bank at 57%.",
      );
    },
  },
  {
    at: 14_000,
    label: "What if JPMorgan defaults?",
    sub: "SVB-2023 brought to life",
    action: ({ stores, toast }) => {
      stores.crisis.activateCounterparty({
        bank: "JPMorgan",
        recoveryDays: 7,
        label: "JPMorgan default · 7d freeze",
      });
      toast.info("Counterparty default armed · JPMorgan");
    },
  },
  {
    at: 18_000,
    label: "Cascade impact",
    sub: "Globe pulses, alerts spike, HHI worsens",
    action: ({ stores }) => {
      stores.time.setOffset(3);
    },
  },
  {
    at: 23_000,
    label: "Recovery timeline",
    sub: "Time machine to +7d shows positions returning",
    action: ({ stores }) => {
      animateOffset(stores, 7, 1_400);
    },
  },
  {
    at: 28_000,
    label: "Ask Sight Copilot",
    sub: "Conversational AI with tool calling",
    action: ({ stores, toast }) => {
      stores.ui.setChatOpen(true);
      toast.info("Sight Copilot · Cmd+J to open anytime");
    },
  },
  {
    at: 36_000,
    label: "Compass redistribution",
    sub: "Sight auto-generates a rebalancing plan",
    action: ({ stores, toast }) => {
      stores.ui.setChatOpen(false);
      toast.info("Sight Compass — auto-rebalance the survivors");
    },
  },
  {
    at: 42_000,
    label: "Restored",
    sub: "All accounts back in the green",
    action: ({ stores }) => {
      stores.crisis.deactivateCounterparty();
      animateOffset(stores, 0, 1_200);
    },
  },
  {
    at: 50_000,
    label: "Live proof",
    sub: "Open /attestation to verify everything you just saw",
    action: ({ toast }) => {
      toast.success("Open /attestation — every claim is verifiable live.");
    },
  },
  {
    at: 58_000,
    label: "Tour complete",
    sub: "Press ▶ to replay, or explore freely",
    action: ({ stores }) => {
      stores.accounts.reset();
      stores.time.reset();
      stores.crisis.clearAll();
      stores.ui.setChatOpen(false);
    },
  },
];

function animateOffset(stores: TourStores, target: number, durationMs: number) {
  const start = stores.time.getOffset();
  if (start === target) return;
  const startedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  function tick(now: number) {
    const t = Math.min(1, (now - startedAt) / durationMs);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = Math.round(start + (target - start) * eased);
    stores.time.setOffset(value);
    if (t < 1) {
      if (typeof requestAnimationFrame !== "undefined") {
        requestAnimationFrame(tick);
      }
    }
  }
  if (typeof requestAnimationFrame !== "undefined") {
    requestAnimationFrame(tick);
  } else {
    stores.time.setOffset(target);
  }
}

/**
 * Find the current step based on elapsed milliseconds.
 */
export function stepAt(elapsedMs: number): TourStep | null {
  let current: TourStep | null = null;
  for (const step of TOUR_SCRIPT) {
    if (step.at <= elapsedMs) current = step;
    else break;
  }
  return current;
}
