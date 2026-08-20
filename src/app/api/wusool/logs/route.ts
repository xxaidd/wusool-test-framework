import { z } from "zod";
import { createServerBackendLogRepository } from "@/features/sessions/infrastructure/serverBackendLogRepository";
import { resolveEnvironment } from "@/infrastructure/server/environmentResolver";
import { ValidationError } from "@/shared/errors";
import { fail, json, ok } from "../helpers";
import { envInputSchema } from "../schemas";

const DEFAULT_WINDOW_MS = 60_000;
const MAX_WINDOW_MS = 10 * 60_000;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

const logsSchema = z.object({
  env: envInputSchema,
  correlationId: z.string().min(1),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  limit: z.number().int().positive().optional(),
});

/**
 * Clamp a requested time window to a bounded server-side range so log queries
 * can never scan an unbounded span (potential pitfall: bounded query windows).
 * Defaults to ±60 s around "now" and shrinks the span to 10 minutes max.
 */
function resolveWindow(
  since?: string,
  until?: string,
): { since: string; until: string } {
  const now = Date.now();
  const sRaw = since != null ? Date.parse(since) : Number.NaN;
  const uRaw = until != null ? Date.parse(until) : Number.NaN;
  if (
    (since != null && !Number.isFinite(sRaw)) ||
    (until != null && !Number.isFinite(uRaw))
  ) {
    throw new ValidationError("Invalid log time window.");
  }

  let start = Number.isFinite(sRaw) ? sRaw : now - DEFAULT_WINDOW_MS;
  let end = Number.isFinite(uRaw) ? uRaw : now + DEFAULT_WINDOW_MS;

  if (start >= end) {
    if (Number.isFinite(sRaw) && Number.isFinite(uRaw)) {
      throw new ValidationError("Invalid log time window.");
    }
    const anchor = Number.isFinite(sRaw) ? sRaw : uRaw;
    start = anchor - DEFAULT_WINDOW_MS;
    end = anchor + DEFAULT_WINDOW_MS;
  }

  if (end - start > MAX_WINDOW_MS) {
    const overflow = end - start - MAX_WINDOW_MS;
    start += Math.floor(overflow / 2);
    end = start + MAX_WINDOW_MS;
  }

  return {
    since: new Date(start).toISOString(),
    until: new Date(end).toISOString(),
  };
}

/**
 * Retrieve correlated backend logs for an event's correlation id. The
 * environment is resolved server-side; the log endpoint is contract-gated, so
 * an unconfigured endpoint returns an explicit `LOG_API_UNAVAILABLE` error.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = logsSchema.parse(await request.json());
    const env = await resolveEnvironment(body.env);
    const window = resolveWindow(body.since, body.until);
    const limit = Math.min(body.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const repo = createServerBackendLogRepository(env);
    const result = await repo.fetchForCorrelation({
      envId: env.id,
      correlationId: body.correlationId,
      since: window.since,
      until: window.until,
      limit,
    });

    if (result.status === "success") {
      return ok({ entries: result.entries });
    }
    if (result.status === "unavailable") {
      return json(
        {
          ok: false,
          error: {
            code: "LOG_API_UNAVAILABLE",
            message: "Backend log API is not configured.",
          },
        },
        501,
      );
    }
    if (result.status === "permission") {
      return json(
        {
          ok: false,
          error: { code: "LOG_API_PERMISSION", message: "Unauthorized." },
        },
        403,
      );
    }
    return json(
      {
        ok: false,
        error: { code: "BACKEND_LOG", message: result.message },
      },
      502,
    );
  } catch (err) {
    return fail(err);
  }
}
