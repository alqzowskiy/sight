import { NextResponse } from "next/server";
import { db, resolveTenantId } from "@/lib/db/client";
import { tenantUnavailable } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/anomalies
 *
 * Returns anomalous transactions for the current tenant, scoped by isAnomaly
 * flag and ordered by score desc. Empty for tenants without seeded transactions
 * (blank tenants and cloned-demo tenants currently both fall here — anomaly
 * seeding alongside clone is a Y2 enhancement).
 */
export async function GET() {
  const tenantId = await resolveTenantId();
  if (!tenantId) return tenantUnavailable();

  const rows = await db.transaction.findMany({
    where: { tenantId, isAnomaly: true },
    orderBy: { anomalyScore: "desc" },
    take: 200,
  });

  const byAccount: Record<
    string,
    Array<{
      date: string;
      timestamp: string;
      channel: string;
      amount: number;
      score: number;
    }>
  > = {};
  for (const r of rows) {
    (byAccount[r.accountId] ??= []).push({
      date: r.timestamp.toISOString().slice(0, 10),
      timestamp: r.timestamp.toISOString(),
      channel: r.channel,
      amount: r.amount,
      score: r.anomalyScore ?? 0,
    });
  }

  return NextResponse.json({
    total: rows.length,
    byAccount,
  });
}
