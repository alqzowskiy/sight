import { NextResponse } from "next/server";
import { db, resolveTenantId } from "@/lib/db/client";
import { tenantUnavailable } from "@/lib/api/errors";
import { computeFxHedgePlan } from "@/lib/utils/fx-hedge";
import type { Account, Currency } from "@/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/fx-hedge
 *
 * Returns the current FX hedge plan for the tenant. Pure math over live
 * account balances — no third-party FX execution venue is contacted.
 */
export async function GET() {
  const tenantId = await resolveTenantId();
  if (!tenantId) return tenantUnavailable();

  const accounts = await db.account.findMany({
    where: { tenantId, isActive: true },
  });
  const todayPoints = await db.forecast.findMany({
    where: { tenantId, isHistorical: true },
    orderBy: { date: "desc" },
  });

  const latestByAccount = new Map<string, number>();
  for (const p of todayPoints) {
    if (!latestByAccount.has(p.accountId)) {
      latestByAccount.set(p.accountId, p.balance);
    }
  }

  const localAccounts: Account[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    bank: a.bank,
    location: [a.latitude, a.longitude],
    currency: a.currency as Currency,
    balance: latestByAccount.get(a.id) ?? 0,
    minBalance: a.minBalance,
    type: a.type as Account["type"],
    status: "healthy",
  }));

  const plan = computeFxHedgePlan(localAccounts);
  return NextResponse.json(plan);
}
