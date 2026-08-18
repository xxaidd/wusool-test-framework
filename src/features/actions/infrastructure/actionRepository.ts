import { bffRequest, envRef, safeActor } from "@/infrastructure/bff/client";
import { classifyHttpStatus } from "@/shared/errors";
import type { CorrelationInfo } from "@/shared/lib/correlation";
import type {
  SanitizedRequest,
  SanitizedResponse,
} from "@/shared/redaction/redact";
import type {
  ActionRepository,
  ActionRequestInput,
  ActionResult,
} from "../application/actionRepository";

export interface ExecuteEnvelope {
  ok: boolean;
  needsAuth: boolean;
  statusCode?: number;
  data?: unknown;
  error?: string;
  correlation?: CorrelationInfo;
  request?: SanitizedRequest;
  response?: SanitizedResponse;
  durationMs: number;
  position?: { lat: number; lng: number };
}

/**
 * Default {@link ActionRepository} backed by the BFF. The browser sends a
 * safe action reference; the BFF resolves environment + auth server-side and
 * returns sanitized evidence. No token ever leaves the browser.
 */
export const bffActionRepository: ActionRepository = {
  async execute(input: ActionRequestInput): Promise<ActionResult> {
    const res = await bffRequest<ExecuteEnvelope>(
      "/api/wusool/actions/execute",
      {
        env: envRef(input.env),
        actor: safeActor(input.actor),
        actionId: input.action.id,
        args: input.args,
      },
      { signal: input.signal },
    );

    const correlation = res.correlation ?? {};
    if (res.needsAuth) {
      return {
        status: "needs-auth",
        correlation,
        request: res.request,
        response: res.response,
      };
    }
    if (res.ok) {
      return {
        status: "success",
        statusCode: res.statusCode ?? 200,
        data: res.data,
        correlation,
        request: res.request,
        response: res.response,
      };
    }
    return {
      status: "failure",
      classification: classifyHttpStatus(res.statusCode ?? 0),
      statusCode: res.statusCode,
      message: res.error ?? "Unknown error",
      correlation,
      request: res.request,
      response: res.response,
    };
  },
};
