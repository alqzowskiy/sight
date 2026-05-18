import { create } from "zustand";

interface CrisisStore {
  activeScenarios: string[];
  crisisModeOpen: boolean;
  toggleScenario: (id: string) => void;
  clearAll: () => void;
  setCrisisModeOpen: (open: boolean) => void;
}

export const useCrisisStore = create<CrisisStore>((set) => ({
  activeScenarios: [],
  crisisModeOpen: false,
  toggleScenario: (id) =>
    set((state) => ({
      activeScenarios: state.activeScenarios.includes(id)
        ? state.activeScenarios.filter((s) => s !== id)
        : [...state.activeScenarios, id],
    })),
  clearAll: () => set({ activeScenarios: [] }),
  setCrisisModeOpen: (open) => set({ crisisModeOpen: open }),
}));
