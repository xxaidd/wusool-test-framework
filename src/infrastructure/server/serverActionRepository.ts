import {
  buildBody,
  buildPath,
  buildQuery,
} from "@/features/actions/application/actionCatalog";
import type {
  ActionRepository,
  ActionRequestInput,
  ActionResult,
} from "@/features/actions/application/actionRepository";
import {
  extractTraceId,
  ServerApiError,
  serverRequest,
} from "@/infrastructure/server/wusoolServerClient";
import { classifyError, classifyHttpStatus } from "@/shared/errors";
import type { CorrelationInfo } from "@/shared/lib/correlation";
import {
  redact,
  redactRequest,
  redactResponse,
} from "@/shared/redaction/redact";

/**
 * Server-side {@link ActionRepository} executed inside Next route handlers.
 * It derives the concrete request from the action definition, propagates the
 * framework correlation id to the backend, and produces sanitized evidence.
 */
export function createServerActionRepository(
  correlationId: string,
): ActionRepository {
  return {
    async execute(input: ActionRequestInput): Promise<ActionResult> {
      const { env, actor, action, args, token, signal } = input;
      const method = action.method;
      const path = buildPath(action, args, actor);
      const query = buildQuery(action, args);
      const isBody = ["POST", "PUT", "PATCH"].includes(method);
      const body = isBody ? buildBody(action, args, actor) : undefined;

      const request = redactRequest({
        method,
        path,
        query,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
      });

      const correlation: CorrelationInfo = { correlationId };
      try {
        const { status, data, headers } = await serverRequest(env, path, {
          method,
          token,
          params: query,
          data: body,
          signal,
          correlationId,
        });
        correlation.traceId = extractTraceId(headers, data);
        return {
          status: "success",
          statusCode: status,
          data: redact(data),
          correlation,
          request,
          response: redactResponse({ statusCode: status, headers, body: data }),
        };
      } catch (err) {
        if (err instanceof ServerApiError) {
          if (err.headers) {
            correlation.traceId = extractTraceId(err.headers, err.body);
          }
          const response = redactResponse({
            statusCode: err.status,
            headers: err.headers ?? {},
            body: err.body,
          });
          if (err.status === 401 || err.status === 403) {
            return { status: "needs-auth", correlation, request, response };
          }
          return {
            status: "failure",
            classification: classifyHttpStatus(err.status),
            statusCode: err.status,
            message: err.message,
            correlation,
            request,
            response,
          };
        }
        return {
          status: "failure",
          classification: classifyError(err),
          statusCode: 0,
          message: err instanceof Error ? err.message : "Unknown error",
          correlation,
          request,
        };
      }
    },
  };
}
