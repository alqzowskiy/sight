import { NextResponse } from "next/server";
import { db, resolveTenantId } from "@/lib/db/client";
import { badRequest, tenantUnavailable } from "@/lib/api/errors";
import {
  computeHHI,
  type AccountWithCountry,
  type ConcentrationDimension,
} from "@/lib/utils/concentration";
import type { Account, Currency } from "@/types";

export const dynamic = "force-dynamic";

const ALLOWED_DIMENSIONS: ConcentrationDimension[] = [
  "bank",
  "currency",
  "country",
];

function isDimension(s: string | null): s is ConcentrationDimension {
  return s !== null && (ALLOWED_DIMENSIONS as string[]).includes(s);
}

export async function GET(req: Request) {
  const tenantId = await resolveTenantId();
  if (!tenantId) return tenantUnavailable();

  const url = new URL(req.url);
  const dimensionRaw = url.searchParams.get("dimension") ?? "bank";
  if (!isDimension(dimensionRaw)) {
    return badRequest("dimension must be bank | currency | country");
  }
  const dimension: ConcentrationDimension = dimensionRaw;

  const accounts = await db.account.findMany({
    where: { tenantId, isActive: true },
  });

  // Pull current balance from latest historical forecast (today).
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

  const enriched: AccountWithCountry[] = accounts.map((a) => {
    const balance = latestByAccount.get(a.id) ?? 0;
    const account: Account = {
      id: a.id,
      name: a.name,
      bank: a.bank,
      location: [a.latitude, a.longitude],
      currency: a.currency as Currency,
      balance,
      minBalance: a.minBalance,
      type: a.type as Account["type"],
      status: "healthy",
    };
    return { ...account, country: a.country };
  });

  const result = computeHHI(enriched, dimension);
  return NextResponse.json(result);
}
