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
  /** True after the first successful API hydration. UI can show a skeleton until then. */
  hydrated: boolean;
  /** Unix ms of the last successful API sync, or null if never synced. */
  lastSyncedAt: number | null;
  /** True while a hydrate is in flight. */
  syncing: boolean;
  /** Sync local state from the API. Call on mount and after server-side changes. */
  fetchFromApi: () => Promise<void>;
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
  sendAmount: number,
  receivedAmount?: number,
): Account[] {
  const credited = receivedAmount ?? sendAmount;
  return accounts.map((a) => {
    if (a.id === to) {
      return {
        ...a,
        balance: a.balance + credited,
        status: "healthy" as const,
      };
    }
    if (a.id === from) {
      return { ...a, balance: a.balance - sendAmount };
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

interface ApiAccount {
  id: string;
  name: string;
  bank: string;
  currency: Currency;
  country: string;
  location: [number, number];
  balance: number;
  minBalance: number;
  type: AccountType;
  status: Account["status"];
}

interface ApiTransfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  amountCurrency: Currency;
  receivedAmount: number | null;
  receivedCurrency: string | null;
  channel: TransferChannel | "SEPA_INSTANT" | "SEPA_STANDARD" | "INTERNAL";
  status: "RECOMMENDED" | "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";
  origin: "ALERT" | "COMPASS" | "OPTIMIZER" | "MANUAL";
  reason: string | null;
  createdAt: string;
  executedAt: string | null;
}

function apiToLocalAccount(a: ApiAccount): Account {
  return {
    id: a.id,
    name: a.name,
    bank: a.bank,
    location: a.location,
    currency: a.currency,
    balance: a.balance,
    minBalance: a.minBalance,
    type: a.type,
    status: a.status,
  };
}

function apiToLocalTransfer(
  t: ApiTransfer,
  locationLookup: Record<string, [number, number]>,
): Transfer {
  // Normalize SEPA_INSTANT/SEPA_STANDARD to the legacy SEPA channel for
  // backwards compatibility with components that only know the 4 channels.
  const channel: TransferChannel =
    t.channel === "INTERNAL"
      ? "SWIFT"
      : t.channel === "SEPA_INSTANT" || t.channel === "SEPA_STANDARD"
        ? "SEPA"
        : (t.channel as TransferChannel);
  return {
    id: t.id,
    from: t.fromAccountId,
    to: t.toAccountId,
    fromLocation: locationLookup[t.fromAccountId] ?? [0, 0],
    toLocation: locationLookup[t.toAccountId] ?? [0, 0],
    channel,
    amount: t.amount,
    currency: t.amountCurrency,
    status: t.status === "COMPLETED" ? "completed" : "pending",
    timestamp: t.executedAt ?? t.createdAt,
    receivedAmount: t.receivedAmount ?? undefined,
    receivedCurrency: (t.receivedCurrency ?? undefined) as Currency | undefined,
  };
}

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
  hydrated: false,
  lastSyncedAt: null,
  syncing: false,
  fetchFromApi: async () => {
    if (typeof window === "undefined") return;
    set({ syncing: true });
    try {
      const [accountsRes, transfersRes] = await Promise.all([
        fetch("/api/v1/accounts", { cache: "no-store" }),
        fetch("/api/v1/transfers", { cache: "no-store" }),
      ]);
      if (!accountsRes.ok || !transfersRes.ok) {
        console.error("[accounts-store] hydrate failed");
        set({ syncing: false });
        return;
      }
      const { accounts: apiAccounts } = (await accountsRes.json()) as {
        accounts: ApiAccount[];
      };
      const { transfers: apiTransfers } = (await transfersRes.json()) as {
        transfers: ApiTransfer[];
      };
      const localAccounts = apiAccounts.map(apiToLocalAccount);
      const locationLookup: Record<string, [number, number]> = {};
      for (const a of localAccounts) locationLookup[a.id] = a.location;
      const localTransfers = apiTransfers
        .map((t) => apiToLocalTransfer(t, locationLookup))
        // Server returns newest first; UI expects chronological order.
        .reverse();
      set({
        accounts: localAccounts,
        transfers: localTransfers,
        hydrated: true,
        lastSyncedAt: Date.now(),
        syncing: false,
      });
    } catch (err) {
      console.error("[accounts-store] hydrate error:", err);
      set({ syncing: false });
    }
  },
  executeTransfer: (transfer) => {
    const current = useAccountsStore.getState().accounts;
    if (!hasSufficientFunds(current, transfer.from, transfer.amount)) {
      return false;
    }
    // Optimistic update — apply locally for instant UI feedback.
    set((state) => {
      const accounts = applyTransferToAccounts(
        state.accounts,
        transfer.from,
        transfer.to,
        transfer.amount,
        transfer.receivedAmount,
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

    // Persist to server in the background. On success, server is the source
    // of truth — we'll resync the next time fetchFromApi runs.
    if (typeof window !== "undefined") {
      void fetch("/api/v1/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAccountId: transfer.from,
          toAccountId: transfer.to,
          amount: transfer.amount,
          channel: transfer.channel,
          origin: "MANUAL",
        }),
      }).catch((err) =>
        console.error("[accounts-store] transfer POST failed:", err),
      );
    }
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
