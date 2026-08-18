import { z } from "zod";
import { ServerApiError } from "@/infrastructure/server/wusoolServerClient";
import type { AppError } from "@/shared/errors";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Standard success envelope: `{ ok: true, data }`. */
export function ok(data: unknown): Response {
  return json({ ok: true, data });
}

function isAppError(err: unknown): err is AppError {
  return (
    typeof err === "object" &&
    err != null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string"
  );
}

/**
 * Standard failure envelope: `{ ok: false, error: { code, message } }`.
 * Client errors (validation/environment/authentication) map to 4xx; backend
 * failures pass through their status; anything else becomes 500.
 */
export function fail(err: unknown): Response {
  let status = 500;
  let code = "INTERNAL";
  let message = "Unexpected server error";

  if (err instanceof ServerApiError) {
    status = err.status >= 400 && err.status <= 599 ? err.status : 502;
    code = err.code ?? "BACKEND";
    message = err.message;
  } else if (err instanceof z.ZodError) {
    status = 400;
    code = "VALIDATION";
    message = err.issues[0]?.message ?? "Invalid request body.";
  } else if (isAppError(err)) {
    if (err.code === "VALIDATION" || err.code === "ENVIRONMENT") {
      status = 400;
    } else if (err.code === "AUTHENTICATION") {
      status = 401;
    } else if (err.code === "BACKEND_UNAVAILABLE") {
      status = 502;
    }
    code = err.code;
    message = err.message;
  } else if (err instanceof Error) {
    message = err.message;
  }

  return json({ ok: false, error: { code, message } }, status);
}
