import { NextResponse } from "next/server";
import { db, resolveTenantId } from "@/lib/db/client";
import { tenantUnavailable } from "@/lib/api/errors";
import type { AccountDTO } from "@/lib/api/schemas";

export const dynamic = "force-dynamic";

// Status is derived from today's balance vs minBalance.
function statusFor(
  balance: number,
  minBalance: number,
): "healthy" | "warning" | "critical" {
  if (minBalance === 0) return "healthy";
  const ratio = balance / minBalance;
  if (ratio < 0.5 || balance < 0) return "critical";
  if (ratio < 1.0) return "warning";
  return "healthy";
}

export async function GET() {
  const tenantId = await resolveTenantId();
  if (!tenantId) return tenantUnavailable();

  const accounts = await db.account.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: "asc" },
  });

  // Today's balance is the most recent historical forecast point for each account.
  // We pull all of them in one query and pick the freshest per account.
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

  const dtos: AccountDTO[] = accounts.map((a) => {
    const balance = latestByAccount.get(a.id) ?? 0;
    return {
      id: a.id,
      name: a.name,
      bank: a.bank,
      currency: a.currency as AccountDTO["currency"],
      country: a.country,
      location: [a.latitude, a.longitude],
      balance,
      minBalance: a.minBalance,
      type: a.type as AccountDTO["type"],
      status: statusFor(balance, a.minBalance),
    };
  });

  return NextResponse.json({ accounts: dtos });
}
