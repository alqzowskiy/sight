import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, details } },
    { status },
  );
}

export function badRequest(message: string, details?: unknown) {
  return apiError("BAD_REQUEST", message, 400, details);
}

export function notFound(message = "Resource not found") {
  return apiError("NOT_FOUND", message, 404);
}

export function serverError(message = "Internal server error") {
  return apiError("INTERNAL_ERROR", message, 500);
}

export function tenantUnavailable() {
  return apiError(
    "TENANT_NOT_PROVISIONED",
    "Demo tenant has not been seeded. Run `pnpm db:seed` and refresh.",
    503,
  );
}

export function zodError(err: ZodError) {
  return badRequest("Request validation failed", err.flatten());
}
