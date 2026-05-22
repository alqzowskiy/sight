import { z } from "zod";
import { streamText, tool, convertToModelMessages } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { db, resolveTenantId } from "@/lib/db/client";
import {
  computeHHI,
  type AccountWithCountry,
  type ConcentrationDimension,
} from "@/lib/utils/concentration";
import { convertAmount } from "@/lib/optimizer/fx";
import type { Account, Currency } from "@/types";

export const maxDuration = 30;

// =============================================================================
// Helpers shared across tools
// =============================================================================

interface AccountSnapshot extends AccountWithCountry {
  bank: string;
}

async function loadAccounts(tenantId: string): Promise<AccountSnapshot[]> {
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

  return accounts.map((a) => {
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
      status:
        a.minBalance === 0
          ? "healthy"
          : balance < a.minBalance * 0.5
            ? "critical"
            : balance < a.minBalance
              ? "warning"
              : "healthy",
    };
    return { ...account, country: a.country };
  });
}

function fmt(amount: number, currency: string): string {
  const symbol: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    CHF: "CHF ",
    SGD: "S$",
  };
  return `${symbol[currency] ?? currency + " "}${Math.round(amount).toLocaleString("en-US")}`;
}

// =============================================================================
// System prompt builder — includes live tenant context
// =============================================================================

async function buildSystemPrompt(
  tenantId: string,
  accountId: string | null,
): Promise<string> {
  const accounts = await loadAccounts(tenantId);
  const concentration = computeHHI(accounts, "bank");

  const focused = accountId
    ? accounts.find((a) => a.id === accountId)
    : undefined;

  const recentTransfers = await db.transfer.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const accountList = accounts
    .map(
      (a) =>
        `  - ${a.id}: ${a.name} · ${a.bank} (${a.currency}) · balance ${fmt(a.balance, a.currency)} · min ${fmt(a.minBalance, a.currency)} · ${a.status}`,
    )
    .join("\n");

  const focusBlock = focused
    ? `\nCurrently focused account: ${focused.id} (${focused.name}, ${focused.bank}).`
    : "";

  const transfersBlock =
    recentTransfers.length > 0
      ? `\nRecent transfers:\n${recentTransfers
          .map(
            (t) =>
              `  - ${t.executedAt?.toISOString().slice(0, 16) ?? "pending"}: ${t.fromAccountId} → ${t.toAccountId}, ${fmt(t.amount, t.amountCurrency)} via ${t.channel} (${t.origin})`,
          )
          .join("\n")}`
      : "";

  return `You are Sight Copilot, an AI assistant for fintech treasury teams managing multi-currency liquidity across multiple banks.

Your role:
- Answer treasury questions clearly and concisely (2-4 sentences default, longer only when explaining a chain of consequences).
- Reference specific accounts by id when relevant.
- Use the tools when the user wants you to compute something — never invent numbers.
- After a tool call, summarize the result in plain language.
- If asked to "do" something irreversible (move money), remember that Sight is Co-pilot not Autopilot — describe what you'd do, but the user always executes with an explicit Execute button.

Current portfolio snapshot:
- Total tenant: ${accounts.length} active accounts
- HHI by bank: ${concentration.hhi} (${concentration.level}), risk-adjusted ${concentration.hhiRiskAdjusted}
- Top concentration: ${concentration.breakdown[0]?.key ?? "n/a"} at ${Math.round((concentration.breakdown[0]?.share ?? 0) * 100)}%

Accounts:
${accountList}${focusBlock}${transfersBlock}

Tone: calm, professional, treasury-fluent. No emojis. No exclamation marks. No marketing language.`;
}

// =============================================================================
// Tools — these compute hypotheticals, they DO NOT mutate the database.
// Co-pilot mode: AI suggests, human executes via the dashboard.
// =============================================================================

function makeTools(tenantId: string) {
  return {
    /**
     * Simulate a transfer's impact on balances without writing to the DB.
     */
    simulateTransfer: tool({
      description:
        "Simulate a hypothetical transfer between two accounts and report the predicted impact on balances, status, and alerts. Does NOT execute the transfer — only computes the what-if.",
      inputSchema: z.object({
        fromAccountId: z.string(),
        toAccountId: z.string(),
        amount: z.number().positive(),
      }),
      execute: async ({ fromAccountId, toAccountId, amount }) => {
        const accounts = await loadAccounts(tenantId);
        const from = accounts.find((a) => a.id === fromAccountId);
        const to = accounts.find((a) => a.id === toAccountId);
        if (!from || !to) {
          return { error: "One or both accounts not found in current tenant" };
        }
        const sentInUsd = convertAmount(amount, from.currency, "USD");
        const receivedAmount =
          from.currency === to.currency
            ? amount
            : convertAmount(amount, from.currency, to.currency);

        const fromAfter = from.balance - amount;
        const toAfter = to.balance + receivedAmount;
        const fromStatusAfter =
          from.minBalance === 0
            ? "healthy"
            : fromAfter < from.minBalance * 0.5
              ? "critical"
              : fromAfter < from.minBalance
                ? "warning"
                : "healthy";
        const toStatusAfter =
          to.minBalance === 0
            ? "healthy"
            : toAfter < to.minBalance * 0.5
              ? "critical"
              : toAfter < to.minBalance
                ? "warning"
                : "healthy";

        return {
          from: {
            id: from.id,
            name: from.name,
            currency: from.currency,
            balanceBefore: from.balance,
            balanceAfter: fromAfter,
            statusBefore: from.status,
            statusAfter: fromStatusAfter,
          },
          to: {
            id: to.id,
            name: to.name,
            currency: to.currency,
            balanceBefore: to.balance,
            balanceAfter: toAfter,
            statusBefore: to.status,
            statusAfter: toStatusAfter,
            receivedAmount,
          },
          channel: from.currency === to.currency
            ? from.currency === "EUR"
              ? "SEPA"
              : "SWIFT"
            : "SWIFT (with FX)",
          fxApplied: from.currency !== to.currency,
          usdValue: sentInUsd,
          recommendation:
            fromStatusAfter === "critical"
              ? "WARNING: source account drops below 50% of minimum after this transfer."
              : toStatusAfter === "critical"
                ? "Destination remains critical even after this transfer — consider a larger amount."
                : "Transfer is feasible and improves the recipient's status.",
        };
      },
    }),

    /**
     * Snapshot of current HHI by bank / currency / country.
     */
    getConcentration: tool({
      description:
        "Get the current concentration HHI for the portfolio, optionally by bank / currency / country. Returns the index value, level, and top buckets.",
      inputSchema: z.object({
        dimension: z
          .enum(["bank", "currency", "country"])
          .default("bank")
          .describe("Which dimension to compute concentration across."),
      }),
      execute: async ({ dimension }) => {
        const accounts = await loadAccounts(tenantId);
        const result = computeHHI(
          accounts,
          dimension as ConcentrationDimension,
        );
        return {
          dimension,
          hhi: result.hhi,
          hhiRiskAdjusted: result.hhiRiskAdjusted,
          level: result.level,
          riskAdjustedLevel: result.riskAdjustedLevel,
          breakdown: result.breakdown.slice(0, 5),
          totalUsd: Math.round(result.totalUsd),
        };
      },
    }),

    /**
     * What-if a single counterparty defaults — computes the cascade impact
     * without mutating anything.
     */
    triggerCounterpartyTest: tool({
      description:
        "Run a what-if counterparty default test for a specific bank: which accounts get frozen, how much USD-equivalent capital is at risk, and what the post-event HHI looks like across the remaining banks.",
      inputSchema: z.object({
        bank: z.string().describe("Bank name as it appears on accounts (e.g. JPMorgan, Deutsche Bank)."),
        recoveryDays: z
          .number()
          .int()
          .min(1)
          .max(60)
          .default(14)
          .describe("Days until recovery starts."),
      }),
      execute: async ({ bank, recoveryDays }) => {
        const accounts = await loadAccounts(tenantId);
        const affected = accounts.filter((a) => a.bank === bank);
        if (affected.length === 0) {
          const available = Array.from(new Set(accounts.map((a) => a.bank)));
          return {
            error: `No accounts at "${bank}". Try one of: ${available.join(", ")}`,
          };
        }
        const survivors = accounts.filter((a) => a.bank !== bank);
        const frozenUsd = affected.reduce(
          (sum, a) => sum + convertAmount(a.balance, a.currency, "USD"),
          0,
        );
        const survivorHhi = computeHHI(survivors, "bank");

        return {
          bank,
          recoveryDays,
          frozenAccounts: affected.map((a) => ({
            id: a.id,
            name: a.name,
            currency: a.currency,
            frozenBalance: a.balance,
            minBalance: a.minBalance,
          })),
          frozenUsd: Math.round(frozenUsd),
          survivorCount: survivors.length,
          hhiAfter: survivorHhi.hhi,
          hhiAfterLevel: survivorHhi.level,
          topSurvivorBank: survivorHhi.breakdown[0]?.key,
          interpretation:
            survivorHhi.hhi > 4000
              ? "Survivor concentration spikes well into the high-risk band — even a smaller second-bank failure would be devastating."
              : survivorHhi.hhi > 2500
                ? "Survivor concentration is in the moderate band. Watch the new top counterparty closely."
                : "Survivor concentration stays manageable.",
        };
      },
    }),
  };
}

// =============================================================================
// Route
// =============================================================================

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY && !process.env.AI_GATEWAY_API_KEY) {
    return new Response(
      JSON.stringify({
        error:
          "AI chat requires OPENAI_API_KEY (or AI_GATEWAY_API_KEY) in env.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const tenantId = await resolveTenantId();
  if (!tenantId) {
    return new Response(
      JSON.stringify({ error: "Tenant not provisioned. Run `pnpm db:seed`." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const body = (await req.json()) as {
    messages: Array<{ role: string; content?: string; parts?: unknown[] }>;
    accountId?: string;
  };

  const systemPrompt = await buildSystemPrompt(
    tenantId,
    body.accountId ?? null,
  );
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // useChat sends messages as UIMessage[]; convertToModelMessages turns them
  // into the format streamText expects.
  // @ts-expect-error - UIMessage shape comes from client useChat
  const modelMessages = await convertToModelMessages(body.messages);

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: systemPrompt,
    messages: modelMessages,
    tools: makeTools(tenantId),
    temperature: 0.5,
    stopWhen: ({ steps }) => steps.length >= 5,
  });

  return result.toUIMessageStreamResponse();
}
