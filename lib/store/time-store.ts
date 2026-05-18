import { create } from "zustand";

interface TimeStore {
  currentOffset: number;
  isPlaying: boolean;
  setOffset: (days: number) => void;
  togglePlay: () => void;
  reset: () => void;
}

export const useTimeStore = create<TimeStore>((set) => ({
  currentOffset: 0,
  isPlaying: false,
  setOffset: (days) => set({ currentOffset: days }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  reset: () => set({ currentOffset: 0, isPlaying: false }),
}));
