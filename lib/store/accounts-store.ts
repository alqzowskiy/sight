import { create } from "zustand";
import type {
  Account,
  AccountType,
  Transfer,
  Currency,
  TransferChannel,
} from "@/types";
import { buildAccountsFromMeta } from "@/lib/data/accounts";
import {
  getToday,
  removeRuntimeForecast,
  setRuntimeForecast,
} from "@/lib/data/forecasts";
import { useInsightsStore } from "@/lib/store/insights-store";
import { generateForecastForAccount } from "@/lib/utils/synthetic-forecast";

function invalidateInsights(accountIds: string[]) {
  const store = useInsightsStore.getState();
  for (const id of accountIds) {
    store.clear(id);
  }
}

export interface AdHocTransferSpec {
  from: string;
  to: string;
  fromLocation: [number, number];
  toLocation: [number, number];
  channel: TransferChannel;
  amount: number;
  currency: Currency;
}

export interface NewAccountSpec {
  id?: string;
  name: string;
  bank: string;
  currency: Currency;
  country: string;
  location: [number, number];
  balance: number;
  minBalance: number;
  type: AccountType;
}

export interface AccountMetaPatch {
  name?: string;
  bank?: string;
}

interface AccountsStore {
  accounts: Account[];
  transfers: Transfer[];
  customAccountIds: Record<string, true>;
  dismissedAccountIds: Record<string, true>;
  lastExecutedTransferId: string | null;
  executeTransfer: (transfer: Transfer) => boolean;
  addAndExecuteTransfer: (spec: AdHocTransferSpec) => string | null;
  updateAccountMeta: (id: string, patch: AccountMetaPatch) => void;
  addAccount: (spec: NewAccountSpec) => string;
  removeAccount: (id: string) => void;
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
      return { ...a, balance: a.balance - amount };
    }
    return a;
  });
}

function hasSufficientFunds(
  accounts: Account[],
  from: string,
  amount: number,
): boolean {
  const source = accounts.find((a) => a.id === from);
  if (!source) return false;
  return source.balance >= amount;
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

function makeCustomId(name: string, currency: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const rnd = Math.random().toString(36).slice(2, 6);
  return `custom-${currency.toLowerCase()}-${slug || "account"}-${rnd}`;
}

function statusForBalance(balance: number, minBalance: number): Account["status"] {
  if (minBalance === 0) return "healthy";
  const ratio = balance / minBalance;
  if (ratio < 0.5 || balance < 0) return "critical";
  if (ratio < 1.0) return "warning";
  return "healthy";
}

export const useAccountsStore = create<AccountsStore>((set) => ({
  accounts: initialAccounts,
  transfers: [],
  customAccountIds: {},
  dismissedAccountIds: {},
  lastExecutedTransferId: null,
  executeTransfer: (transfer) => {
    const current = useAccountsStore.getState().accounts;
    if (!hasSufficientFunds(current, transfer.from, transfer.amount)) {
      return false;
    }
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
    invalidateInsights([transfer.from, transfer.to]);
    return true;
  },
  addAndExecuteTransfer: (spec) => {
    const current = useAccountsStore.getState().accounts;
    if (!hasSufficientFunds(current, spec.from, spec.amount)) {
      return null;
    }
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
    invalidateInsights([spec.from, spec.to]);
    return localId;
  },
  updateAccountMeta: (id, patch) => {
    set((state) => ({
      accounts: state.accounts.map((a) =>
        a.id === id
          ? {
              ...a,
              name: patch.name?.trim() ? patch.name.trim() : a.name,
              bank: patch.bank?.trim() ? patch.bank.trim() : a.bank,
            }
          : a,
      ),
    }));
    invalidateInsights([id]);
  },
  addAccount: (spec) => {
    const id = spec.id ?? makeCustomId(spec.name, spec.currency);
    const account: Account = {
      id,
      name: spec.name.trim(),
      bank: spec.bank.trim(),
      location: spec.location,
      currency: spec.currency,
      balance: spec.balance,
      minBalance: spec.minBalance,
      type: spec.type,
      status: statusForBalance(spec.balance, spec.minBalance),
    };
    const forecast = generateForecastForAccount(
      {
        id,
        balance: spec.balance,
        minBalance: spec.minBalance,
        type: spec.type,
      },
      getToday(),
    );
    setRuntimeForecast(id, forecast);
    set((state) => ({
      accounts: [...state.accounts, account],
      customAccountIds: { ...state.customAccountIds, [id]: true },
    }));
    return id;
  },
  removeAccount: (id) => {
    removeRuntimeForecast(id);
    set((state) => {
      const { [id]: _removed, ...remainingCustom } = state.customAccountIds;
      return {
        accounts: state.accounts.filter((a) => a.id !== id),
        customAccountIds: remainingCustom,
      };
    });
    invalidateInsights([id]);
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
    useInsightsStore.setState({ byKey: {}, inflight: {} });
    // Drop any runtime forecasts registered for custom accounts.
    const customIds = Object.keys(useAccountsStore.getState().customAccountIds);
    for (const id of customIds) removeRuntimeForecast(id);
    set({
      accounts: buildAccountsFromMeta(),
      transfers: [],
      customAccountIds: {},
      dismissedAccountIds: {},
      lastExecutedTransferId: null,
    });
  },
}));
