import { NextResponse } from "next/server";
import { db, resolveTenantId } from "@/lib/db/client";
import { tenantUnavailable } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(req: Request) {
  const tenantId = await resolveTenantId();
  if (!tenantId) return tenantUnavailable();

  const url = new URL(req.url);
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, limitRaw), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const eventType = url.searchParams.get("eventType") ?? undefined;
  const entityId = url.searchParams.get("entityId") ?? undefined;

  const where = {
    tenantId,
    ...(eventType ? { eventType } : {}),
    ...(entityId ? { entityId } : {}),
  };

  const [events, total] = await Promise.all([
    db.auditEvent.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take: limit,
    }),
    db.auditEvent.count({ where }),
  ]);

  return NextResponse.json({
    total,
    events: events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      actorId: e.actorId,
      entityId: e.entityId,
      payload: e.payload ? JSON.parse(e.payload) : null,
      occurredAt: e.occurredAt.toISOString(),
    })),
  });
}
