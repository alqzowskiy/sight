import { create } from "zustand";

interface DemoStore {
  isRunning: boolean;
  setRunning: (running: boolean) => void;
  toggle: () => void;
}

export const useDemoStore = create<DemoStore>((set) => ({
  isRunning: false,
  setRunning: (running) => set({ isRunning: running }),
  toggle: () => set((s) => ({ isRunning: !s.isRunning })),
}));
