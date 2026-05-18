import { create } from "zustand";
import type {
  Account,
  Transfer,
  Currency,
  TransferChannel,
} from "@/types";
import { buildAccountsFromMeta } from "@/lib/data/accounts";

export interface AdHocTransferSpec {
  from: string;
  to: string;
  fromLocation: [number, number];
  toLocation: [number, number];
  channel: TransferChannel;
  amount: number;
  currency: Currency;
}

interface AccountsStore {
  accounts: Account[];
  transfers: Transfer[];
  dismissedAccountIds: Record<string, true>;
  lastExecutedTransferId: string | null;
  executeTransfer: (transfer: Transfer) => void;
  addAndExecuteTransfer: (spec: AdHocTransferSpec) => string;
  dismissAlert: (alertId: string) => void;
  reset: () => void;
}

const FRESH_ARC_MS = 2000;

function applyTransferToAccounts(
  accounts: Account[],
  from: string,
  to: string,
  amount: number,
): Account[] {
  return accounts.map((a) => {
    if (a.id === to) {
      return {
        ...a,
        balance: a.balance + amount,
        status: "healthy" as const,
      };
    }
    if (a.id === from) {
      return { ...a, balance: Math.max(0, a.balance - amount) };
    }
    return a;
  });
}

function scheduleFreshClear(
  set: (fn: (s: AccountsStore) => Partial<AccountsStore>) => void,
  id: string,
) {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    set((s) =>
      s.lastExecutedTransferId === id ? { lastExecutedTransferId: null } : s,
    );
  }, FRESH_ARC_MS);
}

function accountIdFromAlertId(alertId: string): string | null {
  const prefix = "alert-";
  if (!alertId.startsWith(prefix)) return null;
  return alertId.slice(prefix.length);
}

const initialAccounts = buildAccountsFromMeta();

export const useAccountsStore = create<AccountsStore>((set) => ({
  accounts: initialAccounts,
  transfers: [],
  dismissedAccountIds: {},
  lastExecutedTransferId: null,
  executeTransfer: (transfer) => {
    set((state) => {
      const accounts = applyTransferToAccounts(
        state.accounts,
        transfer.from,
        transfer.to,
        transfer.amount,
      );
      const completed: Transfer = { ...transfer, status: "completed" };
      scheduleFreshClear(set, completed.id);
      return {
        accounts,
        transfers: [...state.transfers, completed],
        dismissedAccountIds: {
          ...state.dismissedAccountIds,
          [transfer.to]: true,
        },
        lastExecutedTransferId: completed.id,
      };
    });
  },
  addAndExecuteTransfer: (spec) => {
    const localId = `compass-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    set((state) => {
      const transfer: Transfer = {
        id: localId,
        from: spec.from,
        to: spec.to,
        fromLocation: spec.fromLocation,
        toLocation: spec.toLocation,
        channel: spec.channel,
        amount: spec.amount,
        currency: spec.currency,
        status: "completed",
        timestamp: new Date().toISOString(),
      };
      const accounts = applyTransferToAccounts(
        state.accounts,
        spec.from,
        spec.to,
        spec.amount,
      );
      scheduleFreshClear(set, localId);
      return {
        accounts,
        transfers: [...state.transfers, transfer],
        dismissedAccountIds: {
          ...state.dismissedAccountIds,
          [spec.to]: true,
        },
        lastExecutedTransferId: localId,
      };
    });
    return localId;
  },
  dismissAlert: (alertId) => {
    const accountId = accountIdFromAlertId(alertId);
    if (!accountId) return;
    set((state) => ({
      dismissedAccountIds: {
        ...state.dismissedAccountIds,
        [accountId]: true,
      },
    }));
  },
  reset: () => {
    set({
      accounts: buildAccountsFromMeta(),
      transfers: [],
      dismissedAccountIds: {},
      lastExecutedTransferId: null,
    });
  },
}));
