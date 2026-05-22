import { NextResponse } from "next/server";
import { db, resolveDemoTenantId, resolveTenantId } from "@/lib/db/client";
import {
  badRequest,
  notFound,
  serverError,
  tenantUnavailable,
} from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/onboarding
 *
 * body:
 *   - { mode: "company", companyName, industry?, region? } — update tenant
 *     metadata (Step 0 of the wizard). Does NOT mark onboarded; the user
 *     still needs to pick clone/configure/blank.
 *   - { mode: "clone" } — copy all accounts + forecasts + anomalies from
 *     the public demo tenant (NovaPay) into the user's tenant. Marks onboarded.
 *   - { mode: "blank" } — just flip onboarded=true so the dashboard renders
 *     an empty state ready to add accounts.
 *
 * Idempotent: re-running clone/blank after onboarded is a no-op.
 */
const VALID_REGIONS = new Set(["CIS", "EU", "MENA", "SEA", "US"]);

export async function POST(req: Request) {
  const tenantId = await resolveTenantId();
  if (!tenantId) return tenantUnavailable();

  let body: {
    mode?: string;
    companyName?: string;
    industry?: string;
    region?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return badRequest("Request body must be JSON");
  }

  const mode = body.mode;
  if (mode === "company") {
    const companyName = (body.companyName ?? "").trim();
    if (!companyName) return badRequest("`companyName` is required");
    const region = body.region && VALID_REGIONS.has(body.region) ? body.region : "CIS";
    await db.tenant.update({
      where: { id: tenantId },
      data: {
        name: companyName.slice(0, 80),
        region,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (mode !== "clone" && mode !== "blank") {
    return badRequest("`mode` must be 'company', 'clone', or 'blank'");
  }

  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return notFound("Tenant not found");

  // Already onboarded — just return current state.
  if (tenant.onboarded) {
    return NextResponse.json({ onboarded: true, mode: "already" });
  }

  try {
    if (mode === "blank") {
      await db.$transaction([
        db.tenant.update({
          where: { id: tenantId },
          data: { onboarded: true },
        }),
        db.auditEvent.create({
          data: {
            tenantId,
            eventType: "ONBOARDING_BLANK",
            entityId: tenantId,
            payload: JSON.stringify({}),
          },
        }),
      ]);
      return NextResponse.json({ onboarded: true, mode: "blank" });
    }

    // mode === "clone"
    const demoTenantId = await resolveDemoTenantId();
    if (!demoTenantId) {
      return serverError("Demo tenant not available. Run `pnpm db:seed`.");
    }

    const demoAccounts = await db.account.findMany({
      where: { tenantId: demoTenantId, isActive: true },
    });
    const demoForecasts = await db.forecast.findMany({
      where: { tenantId: demoTenantId },
    });
    const demoAnomalies = await db.transaction.findMany({
      where: { tenantId: demoTenantId, isAnomaly: true },
    });

    // Map demo account id → cloned account id (so we can rewrite forecasts).
    // We keep the same account id since they're scoped by tenantId in queries
    // but Account.id is the primary key (no unique-per-tenant). To support
    // multiple tenants we generate fresh ids.
    const idMap = new Map<string, string>();

    await db.$transaction(
      async (tx) => {
        for (const a of demoAccounts) {
          const newId = `${a.id}-${tenantId.slice(-6)}`;
          idMap.set(a.id, newId);
          await tx.account.create({
            data: {
              id: newId,
              tenantId,
              externalId: a.externalId,
              name: a.name,
              bank: a.bank,
              currency: a.currency,
              country: a.country,
              latitude: a.latitude,
              longitude: a.longitude,
              minBalance: a.minBalance,
              type: a.type,
              isActive: true,
            },
          });
        }

        const forecastRows = demoForecasts
          .map((f) => {
            const newAccountId = idMap.get(f.accountId);
            if (!newAccountId) return null;
            return {
              tenantId,
              accountId: newAccountId,
              date: f.date,
              balance: f.balance,
              p10: f.p10,
              p90: f.p90,
              isHistorical: f.isHistorical,
              modelVersion: f.modelVersion,
              modelChoice: f.modelChoice,
              shapJson: f.shapJson,
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        if (forecastRows.length > 0) {
          await tx.forecast.createMany({ data: forecastRows });
        }

        // Copy anomalous transactions so the cloned tenant lights up the
        // AccountCard anomaly pills and footer counter just like the demo.
        const anomalyRows = demoAnomalies
          .map((a) => {
            const newAccountId = idMap.get(a.accountId);
            if (!newAccountId) return null;
            return {
              tenantId,
              accountId: newAccountId,
              amount: a.amount,
              channel: a.channel,
              counterparty: a.counterparty,
              timestamp: a.timestamp,
              anomalyScore: a.anomalyScore,
              isAnomaly: true,
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);
        if (anomalyRows.length > 0) {
          await tx.transaction.createMany({ data: anomalyRows });
        }

        await tx.tenant.update({
          where: { id: tenantId },
          data: { onboarded: true },
        });

        await tx.auditEvent.create({
          data: {
            tenantId,
            eventType: "ONBOARDING_CLONE_DEMO",
            entityId: tenantId,
            payload: JSON.stringify({
              accounts: demoAccounts.length,
              forecasts: forecastRows.length,
              anomalies: anomalyRows.length,
              source: "novapay",
            }),
          },
        });
      },
      { timeout: 30_000 },
    );

    return NextResponse.json({
      onboarded: true,
      mode: "clone",
      accountsCloned: demoAccounts.length,
      forecastsCloned: demoForecasts.length,
      anomaliesCloned: demoAnomalies.length,
    });
  } catch (err) {
    console.error("[onboarding] failed:", err);
    return serverError(
      err instanceof Error ? err.message : "Onboarding failed",
    );
  }
}
