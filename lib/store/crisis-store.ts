import { create } from "zustand";

/**
 * Configuration for the parameterized "counterparty-default" scenario.
 * Decoupled from the active flag so we can pre-pick a bank before activating.
 */
export interface CounterpartyConfig {
  /** Bank name that's "in default" — must match Account.bank exactly. */
  bank: string;
  /** How many days until balances start recovering. */
  recoveryDays: number;
  /** Optional human label (auto-populated, used in pitch). */
  label?: string;
}

interface CrisisStore {
  activeScenarios: string[];
  crisisModeOpen: boolean;
  /** Config for the parameterized counterparty scenario. */
  counterpartyConfig: CounterpartyConfig | null;
  toggleScenario: (id: string) => void;
  setCounterpartyConfig: (config: CounterpartyConfig | null) => void;
  /** Atomic activation: set config + add scenario in one go (for cascade timing). */
  activateCounterparty: (config: CounterpartyConfig) => void;
  /** Atomic deactivation: remove scenario + clear config. */
  deactivateCounterparty: () => void;
  clearAll: () => void;
  setCrisisModeOpen: (open: boolean) => void;
}

export const useCrisisStore = create<CrisisStore>((set) => ({
  activeScenarios: [],
  crisisModeOpen: false,
  counterpartyConfig: null,
  toggleScenario: (id) =>
    set((state) => ({
      activeScenarios: state.activeScenarios.includes(id)
        ? state.activeScenarios.filter((s) => s !== id)
        : [...state.activeScenarios, id],
    })),
  setCounterpartyConfig: (config) => set({ counterpartyConfig: config }),
  activateCounterparty: (config) =>
    set((state) => ({
      counterpartyConfig: config,
      activeScenarios: state.activeScenarios.includes("counterparty-default")
        ? state.activeScenarios
        : [...state.activeScenarios, "counterparty-default"],
    })),
  deactivateCounterparty: () =>
    set((state) => ({
      counterpartyConfig: null,
      activeScenarios: state.activeScenarios.filter(
        (s) => s !== "counterparty-default",
      ),
    })),
  clearAll: () => set({ activeScenarios: [], counterpartyConfig: null }),
  setCrisisModeOpen: (open) => set({ crisisModeOpen: open }),
}));
