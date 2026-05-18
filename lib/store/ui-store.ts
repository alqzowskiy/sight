import { create } from "zustand";

interface UiStore {
  selectedAccountId: string | null;
  hoveredAccountId: string | null;
  hoveredTransferId: string | null;
  detailPanelOpen: boolean;
  commandPaletteOpen: boolean;
  pendingInsightAccountId: string | null;
  setSelectedAccount: (id: string | null) => void;
  setHoveredAccount: (id: string | null) => void;
  setHoveredTransfer: (id: string | null) => void;
  openDetailPanel: (accountId: string) => void;
  closeDetailPanel: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  requestInsight: (accountId: string) => void;
  clearPendingInsight: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  selectedAccountId: null,
  hoveredAccountId: null,
  hoveredTransferId: null,
  detailPanelOpen: false,
  commandPaletteOpen: false,
  pendingInsightAccountId: null,
  setSelectedAccount: (id) => set({ selectedAccountId: id }),
  setHoveredAccount: (id) => set({ hoveredAccountId: id }),
  setHoveredTransfer: (id) => set({ hoveredTransferId: id }),
  openDetailPanel: (accountId) =>
    set({ selectedAccountId: accountId, detailPanelOpen: true }),
  closeDetailPanel: () => set({ detailPanelOpen: false }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  requestInsight: (accountId) =>
    set({
      selectedAccountId: accountId,
      detailPanelOpen: true,
      pendingInsightAccountId: accountId,
    }),
  clearPendingInsight: () => set({ pendingInsightAccountId: null }),
}));
