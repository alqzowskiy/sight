import { NextResponse } from "next/server";
import { db, resolveTenantId } from "@/lib/db/client";
import { tenantUnavailable, notFound } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const tenantId = await resolveTenantId();
  if (!tenantId) return tenantUnavailable();

  const { accountId } = await params;

  const points = await db.forecast.findMany({
    where: { tenantId, accountId },
    orderBy: { date: "asc" },
  });

  if (points.length === 0) {
    return notFound(`No forecast data for account "${accountId}"`);
  }

  return NextResponse.json({
    accountId,
    modelChoice: points[0].modelChoice,
    modelVersion: points[0].modelVersion,
    points: points.map((p) => ({
      date: p.date.toISOString().slice(0, 10),
      balance: p.balance,
      p10: p.p10,
      p90: p.p90,
      isHistorical: p.isHistorical,
      shap: p.shapJson ? (JSON.parse(p.shapJson) as unknown[]) : undefined,
    })),
  });
}
