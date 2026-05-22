import { NextResponse } from "next/server";
import { db, resolveTenantId } from "@/lib/db/client";
import {
  badRequest,
  notFound,
  serverError,
  tenantUnavailable,
  zodError,
} from "@/lib/api/errors";
import {
  CreateTransferSchema,
  type TransferDTO,
  type AccountDTO,
} from "@/lib/api/schemas";
import { pickChannelAndFee } from "@/lib/optimizer/channels";
import { convertAmount } from "@/lib/optimizer/fx";
import type { AccountType, Currency } from "@/types";

export const dynamic = "force-dynamic";

// =============================================================================
// GET /api/v1/transfers — history
// =============================================================================

export async function GET() {
  const tenantId = await resolveTenantId();
  if (!tenantId) return tenantUnavailable();

  const transfers = await db.transfer.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const dtos: TransferDTO[] = transfers.map((t) => ({
    id: t.id,
    fromAccountId: t.fromAccountId,
    toAccountId: t.toAccountId,
    amount: t.amount,
    amountCurrency: t.amountCurrency as TransferDTO["amountCurrency"],
    receivedAmount: t.receivedAmount,
    receivedCurrency: t.receivedCurrency,
    channel: t.channel as TransferDTO["channel"],
    status: t.status as TransferDTO["status"],
    origin: t.origin as TransferDTO["origin"],
    reason: t.reason,
    createdAt: t.createdAt.toISOString(),
    executedAt: t.executedAt?.toISOString() ?? null,
  }));

  return NextResponse.json({ transfers: dtos });
}

// =============================================================================
// POST /api/v1/transfers — execute
// =============================================================================

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

export async function POST(req: Request) {
  const tenantId = await resolveTenantId();
  if (!tenantId) return tenantUnavailable();

  const parsed = CreateTransferSchema.safeParse(await req.json());
  if (!parsed.success) return zodError(parsed.error);

  const input = parsed.data;
  if (input.fromAccountId === input.toAccountId) {
    return badRequest("Cannot transfer to the same account");
  }

  const [from, to] = await Promise.all([
    db.account.findUnique({ where: { id: input.fromAccountId } }),
    db.account.findUnique({ where: { id: input.toAccountId } }),
  ]);

  if (!from || !to || from.tenantId !== tenantId || to.tenantId !== tenantId) {
    return notFound("Source or destination account not found in this tenant");
  }

  const channelChoice = pickChannelAndFee(
    input.amount,
    { currency: from.currency as Currency, type: from.type as AccountType },
    { currency: to.currency as Currency, type: to.type as AccountType },
  );
  const finalChannel = input.channel ?? channelChoice.channel;
  const isCrossCurrency = from.currency !== to.currency;
  const receivedAmount = isCrossCurrency
    ? convertAmount(input.amount, from.currency as Currency, to.currency as Currency)
    : null;

  try {
    const { transfer, accounts } = await db.$transaction(async (tx) => {
      // 1. Record the transfer (status COMPLETED immediately — demo executes inline).
      const newTransfer = await tx.transfer.create({
        data: {
          tenantId,
          fromAccountId: from.id,
          toAccountId: to.id,
          channel: finalChannel,
          amount: input.amount,
          amountCurrency: from.currency,
          receivedAmount,
          receivedCurrency: isCrossCurrency ? to.currency : null,
          status: "COMPLETED",
          origin: input.origin,
          reason: input.reason ?? null,
          executedAt: new Date(),
        },
      });

      // 2. Apply delta to ALL forecast points from today forward.
      // Historical points are kept untouched (audit trail).
      const today = await tx.forecast.findFirst({
        where: { tenantId, accountId: from.id, isHistorical: true },
        orderBy: { date: "desc" },
        select: { date: true },
      });
      const cutoff = today?.date ?? new Date(0);

      await tx.forecast.updateMany({
        where: {
          tenantId,
          accountId: from.id,
          date: { gte: cutoff },
        },
        data: { balance: { decrement: input.amount } },
      });
      // Two-column update — Prisma's `decrement` API only supports one field at
      // a time, so we drop to a raw query. Postgres uses $1..$N placeholders.
      await tx.$executeRaw`
        UPDATE "Forecast"
        SET "p10" = "p10" - ${input.amount},
            "p90" = "p90" - ${input.amount}
        WHERE "tenantId" = ${tenantId}
          AND "accountId" = ${from.id}
          AND "date" >= ${cutoff}
      `;

      const receivedDelta = receivedAmount ?? input.amount;
      await tx.forecast.updateMany({
        where: {
          tenantId,
          accountId: to.id,
          date: { gte: cutoff },
        },
        data: { balance: { increment: receivedDelta } },
      });
      await tx.$executeRaw`
        UPDATE "Forecast"
        SET "p10" = "p10" + ${receivedDelta},
            "p90" = "p90" + ${receivedDelta}
        WHERE "tenantId" = ${tenantId}
          AND "accountId" = ${to.id}
          AND "date" >= ${cutoff}
      `;

      // 3. Audit event.
      await tx.auditEvent.create({
        data: {
          tenantId,
          eventType: "TRANSFER_EXECUTED",
          entityId: newTransfer.id,
          payload: JSON.stringify({
            from: from.id,
            to: to.id,
            amount: input.amount,
            channel: finalChannel,
            origin: input.origin,
            fee: channelChoice.fee,
            fxApplied: channelChoice.fxApplied,
          }),
        },
      });

      // 4. Return the latest accounts snapshot so the client can patch its store.
      const accounts = await tx.account.findMany({
        where: { tenantId, isActive: true },
        orderBy: { name: "asc" },
      });

      const latestHistorical = await tx.forecast.findMany({
        where: { tenantId, isHistorical: true },
        orderBy: { date: "desc" },
      });
      const latestByAccount = new Map<string, number>();
      for (const p of latestHistorical) {
        if (!latestByAccount.has(p.accountId)) {
          latestByAccount.set(p.accountId, p.balance);
        }
      }

      const accountDtos: AccountDTO[] = accounts.map((a) => {
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

      const transferDto: TransferDTO = {
        id: newTransfer.id,
        fromAccountId: newTransfer.fromAccountId,
        toAccountId: newTransfer.toAccountId,
        amount: newTransfer.amount,
        amountCurrency: newTransfer.amountCurrency as TransferDTO["amountCurrency"],
        receivedAmount: newTransfer.receivedAmount,
        receivedCurrency: newTransfer.receivedCurrency,
        channel: newTransfer.channel as TransferDTO["channel"],
        status: newTransfer.status as TransferDTO["status"],
        origin: newTransfer.origin as TransferDTO["origin"],
        reason: newTransfer.reason,
        createdAt: newTransfer.createdAt.toISOString(),
        executedAt: newTransfer.executedAt?.toISOString() ?? null,
      };

      return { transfer: transferDto, accounts: accountDtos };
    });

    return NextResponse.json({ transfer, accounts });
  } catch (err) {
    console.error("[POST /api/v1/transfers] failed:", err);
    return serverError(
      err instanceof Error ? err.message : "Transfer failed",
    );
  }
}
