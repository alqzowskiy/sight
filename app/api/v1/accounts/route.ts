import { NextResponse } from "next/server";
import { db, resolveTenantId } from "@/lib/db/client";
import {
  badRequest,
  serverError,
  tenantUnavailable,
  zodError,
} from "@/lib/api/errors";
import { CreateAccountSchema, type AccountDTO } from "@/lib/api/schemas";
import { generateBaselineForecast } from "@/lib/ml/baseline-forecast";

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
  const modelChoiceByAccount = new Map<string, string>();
  for (const p of todayPoints) {
    if (!latestByAccount.has(p.accountId)) {
      latestByAccount.set(p.accountId, p.balance);
      modelChoiceByAccount.set(p.accountId, p.modelChoice);
    }
  }

  const dtos: AccountDTO[] = accounts.map((a) => {
    const balance = latestByAccount.get(a.id) ?? 0;
    const modelChoice = modelChoiceByAccount.get(a.id);
    return {
      id: a.id,
      name: a.name,
      bank: a.bank,
      currency: a.currency as AccountDTO["currency"],
      country: a.country,
      city: a.city ?? undefined,
      location: [a.latitude, a.longitude],
      balance,
      minBalance: a.minBalance,
      type: a.type as AccountDTO["type"],
      status: statusFor(balance, a.minBalance),
      isBaseline: modelChoice === "naive",
    };
  });

  return NextResponse.json({ accounts: dtos });
}

// =============================================================================
// POST /api/v1/accounts — create a new account in the current tenant
// =============================================================================

function statusForBalance(
  balance: number,
  minBalance: number,
): "healthy" | "warning" | "critical" {
  if (minBalance === 0) return "healthy";
  const ratio = balance / minBalance;
  if (ratio < 0.5 || balance < 0) return "critical";
  if (ratio < 1.0) return "warning";
  return "healthy";
}

function makeAccountId(name: string, currency: string, tenantSuffix: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return `${slug || currency.toLowerCase()}-${tenantSuffix}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export async function POST(req: Request) {
  const tenantId = await resolveTenantId();
  if (!tenantId) return tenantUnavailable();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be JSON");
  }

  const parsed = CreateAccountSchema.safeParse(body);
  if (!parsed.success) return zodError(parsed.error);

  const input = parsed.data;
  const tenantSuffix = tenantId.slice(-6);
  const id = makeAccountId(input.name, input.currency, tenantSuffix);

  try {
    const account = await db.account.create({
      data: {
        id,
        tenantId,
        externalId: id,
        name: input.name,
        bank: input.bank,
        currency: input.currency,
        country: input.country.toUpperCase(),
        city: input.city,
        latitude: input.location[0],
        longitude: input.location[1],
        minBalance: input.minBalance,
        type: input.type,
        isActive: true,
      },
    });

    // Generate a 90-day baseline history + 14-day naive forecast so the
    // dashboard has something to chart immediately. This is NOT trained ML —
    // it's a placeholder until the per-tenant pipeline lands in Y2. The
    // `modelChoice: "naive"` field is what the UI keys off to show
    // "ML warming up" badges instead of pretending these are stacker outputs.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const baseline = generateBaselineForecast({
      accountId: id,
      openingBalance: input.balance,
      minBalance: input.minBalance,
      anchorDate: today,
    });
    await db.forecast.createMany({
      data: baseline.map((p) => ({
        tenantId,
        accountId: id,
        date: new Date(p.date + "T00:00:00.000Z"),
        balance: p.balance,
        p10: p.p10,
        p90: p.p90,
        isHistorical: p.isHistorical,
        modelVersion: "sight-baseline-v1",
        modelChoice: "naive",
      })),
    });

    await db.auditEvent.create({
      data: {
        tenantId,
        eventType: "ACCOUNT_CREATED",
        entityId: id,
        payload: JSON.stringify({
          name: input.name,
          bank: input.bank,
          currency: input.currency,
          openingBalance: input.balance,
        }),
      },
    });

    const dto: AccountDTO = {
      id: account.id,
      name: account.name,
      bank: account.bank,
      currency: account.currency as AccountDTO["currency"],
      country: account.country,
      city: account.city ?? undefined,
      location: [account.latitude, account.longitude],
      balance: input.balance,
      minBalance: account.minBalance,
      type: account.type as AccountDTO["type"],
      status: statusForBalance(input.balance, account.minBalance),
      isBaseline: true,
    };
    return NextResponse.json({ account: dto }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/v1/accounts] failed:", err);
    return serverError(
      err instanceof Error ? err.message : "Account creation failed",
    );
  }
}
