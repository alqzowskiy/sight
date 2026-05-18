import { NextResponse } from "next/server";
import { z } from "zod";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import accountsJson from "@/public/data/accounts.json";
import forecastsJson from "@/public/data/forecasts.json";

const InsightRequest = z.object({
  accountId: z.string().min(1),
  dayOffset: z.number().int().min(-60).max(60),
  context: z.string().max(400).optional(),
});

interface AccountMeta {
  id: string;
  name: string;
  bank: string;
  currency: string;
  country: string;
  location: [number, number];
  minBalance: number;
  type: string;
}

interface ForecastPoint {
  date: string;
  balance: number;
  p10: number;
  p90: number;
  isHistorical: boolean;
}

const ACCOUNTS: AccountMeta[] = accountsJson as AccountMeta[];
const FORECASTS = forecastsJson as {
  accounts: Record<string, ForecastPoint[]>;
  model_version: string;
};

const SYSTEM_PROMPT = `You are Sight, an AI assistant for treasury teams managing fintech liquidity.

Your job is to explain risks and recommendations in plain language.

Rules:
- Be concise: 2-3 sentences maximum.
- Use specific numbers from the data given.
- Reference dates relative to today ("in 3 days", "Friday").
- Explain WHY the risk is happening (which transactions, which delays).
- Suggest the recommended action briefly.
- Professional, calm tone. No emojis. No exclamation marks. No "I'm Sight" introductions.
- If the account is healthy, say so plainly in one sentence.`;

function formatCurrency(value: number, currency: string): string {
  const symbol: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    CHF: "CHF ",
    SGD: "S$",
  };
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${sign}${symbol[currency] ?? currency + " "}${formatted}`;
}

function buildPrompt(
  account: AccountMeta,
  points: ForecastPoint[],
  dayOffset: number,
  context: string | undefined,
): string {
  const lines = points.map((p) => {
    const tag = p.isHistorical ? "actual" : "forecast";
    return `${p.date} (${tag}): ${formatCurrency(p.balance, account.currency)}` +
      (p.isHistorical ? "" : ` (P10 ${formatCurrency(p.p10, account.currency)} / P90 ${formatCurrency(p.p90, account.currency)})`);
  });
  const horizon =
    dayOffset === 0
      ? "today"
      : dayOffset > 0
        ? `${dayOffset} days into the future`
        : `${Math.abs(dayOffset)} days in the past`;
  return [
    `Account: ${account.name} (${account.currency})`,
    `Bank: ${account.bank}`,
    `Minimum balance required: ${formatCurrency(account.minBalance, account.currency)}`,
    "",
    "Recent history and forecast:",
    ...lines,
    "",
    `Currently viewing: ${horizon}.`,
    context ? `Additional context: ${context}` : "",
    "",
    "Explain the current risk for this account in 2-3 sentences. Mention specific numbers and the timeframe.",
  ]
    .filter(Boolean)
    .join("\n");
}

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;
const recentCalls = new Map<string, number[]>();

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  return real ?? "anon";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (recentCalls.get(ip) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  if (arr.length >= RATE_LIMIT) {
    recentCalls.set(ip, arr);
    return true;
  }
  arr.push(now);
  recentCalls.set(ip, arr);
  return false;
}

function pickPoints(
  accountId: string,
  dayOffset: number,
): ForecastPoint[] {
  const points = FORECASTS.accounts[accountId] ?? [];
  if (points.length === 0) return [];
  const todayIdx = points.findIndex((p) => !p.isHistorical) - 1;
  if (todayIdx < 0) return points.slice(-7);
  const centre = todayIdx + dayOffset;
  const start = Math.max(0, centre - 6);
  const end = Math.min(points.length, centre + 8);
  return points.slice(start, end);
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many insight requests. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "bad_json", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = InsightRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const { accountId, dayOffset, context } = parsed.data;

  const account = ACCOUNTS.find((a) => a.id === accountId);
  if (!account) {
    return NextResponse.json(
      { error: "not_found", message: "Unknown accountId." },
      { status: 404 },
    );
  }
  const points = pickPoints(accountId, dayOffset);
  if (points.length === 0) {
    return NextResponse.json(
      { error: "no_forecast", message: "No forecast data for this account." },
      { status: 404 },
    );
  }

  if (!process.env.OPENAI_API_KEY && !process.env.AI_GATEWAY_API_KEY) {
    return NextResponse.json(
      {
        error: "missing_key",
        message:
          "AI insights require OPENAI_API_KEY (or AI_GATEWAY_API_KEY) in env. See .env.example.",
      },
      { status: 503 },
    );
  }

  const userPrompt = buildPrompt(account, points, dayOffset, context);

  try {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await generateText({
      model: openai("gpt-4o-mini"),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.4,
      maxOutputTokens: 250,
    });

    return NextResponse.json({
      insight: result.text.trim(),
      tokensUsed: result.usage?.totalTokens ?? null,
      model: "gpt-4o-mini",
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: "upstream", message },
      { status: 502 },
    );
  }
}
