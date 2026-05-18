import accountsJson from "@/public/data/accounts.json";
import type { Account, AccountType, Currency } from "@/types";
import { getForecastPointRaw } from "@/lib/data/forecasts";

export interface AccountMeta {
  id: string;
  name: string;
  bank: string;
  currency: Currency;
  country: string;
  location: [number, number];
  minBalance: number;
  type: AccountType;
}

export const accountMetas: AccountMeta[] = (
  accountsJson as AccountMeta[]
).map((a) => ({
  ...a,
  location: [a.location[0], a.location[1]] as [number, number],
}));

function statusFor(meta: AccountMeta, balance: number): Account["status"] {
  if (meta.minBalance === 0) return "healthy";
  const ratio = balance / meta.minBalance;
  if (ratio < 0.5 || balance < 0) return "critical";
  if (ratio < 1.0) return "warning";
  return "healthy";
}

function todayBalanceFor(id: string): number {
  const point = getForecastPointRaw(id, 0);
  if (point) return point.balance;
  return 0;
}

export function buildAccountsFromMeta(): Account[] {
  return accountMetas.map((meta) => {
    const balance = todayBalanceFor(meta.id);
    return {
      id: meta.id,
      name: meta.name,
      bank: meta.bank,
      location: meta.location,
      currency: meta.currency,
      balance,
      minBalance: meta.minBalance,
      type: meta.type,
      status: statusFor(meta, balance),
    };
  });
}

export function getAccountMeta(id: string): AccountMeta | undefined {
  return accountMetas.find((a) => a.id === id);
}
