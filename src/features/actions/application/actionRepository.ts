import type { ActionDef } from "@/features/actions/domain/action.types";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import type { FailureClassification } from "@/shared/errors";
import type { CorrelationInfo } from "@/shared/lib/correlation";
import type {
  SanitizedRequest,
  SanitizedResponse,
} from "@/shared/redaction/redact";

export interface ActionRequestInput {
  env: BackendEnvironment;
  actor: ActorRef;
  action: ActionDef;
  args: Record<string, unknown>;
  /** Resolved bearer token, only available server-side. */
  token?: string;
  signal?: AbortSignal;
}

/**
 * Normalized outcome of a single backend request. `needs-auth` means the
 * request was rejected for authentication (401/403) and should prompt JIT
 * re-authentication; `failure` carries a structured {@link FailureClassification}.
 * `request`/`response` are sanitized evidence produced by infrastructure.
 */
export type ActionResult =
  | {
      status: "success";
      statusCode: number;
      data?: unknown;
      correlation: CorrelationInfo;
      request?: SanitizedRequest;
      response?: SanitizedResponse;
    }
  | {
      status: "needs-auth";
      correlation: CorrelationInfo;
      request?: SanitizedRequest;
      response?: SanitizedResponse;
    }
  | {
      status: "failure";
      classification: FailureClassification;
      statusCode?: number;
      message: string;
      correlation: CorrelationInfo;
      request?: SanitizedRequest;
      response?: SanitizedResponse;
    };

/** Executes a single client action against the backend. Implemented by infrastructure. */
export interface ActionRepository {
  execute(input: ActionRequestInput): Promise<ActionResult>;
}
