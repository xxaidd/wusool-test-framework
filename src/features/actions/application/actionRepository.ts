import type { HttpMethod } from "@/features/actions/domain/action.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import type { FailureClassification } from "@/shared/errors";
import type { CorrelationInfo } from "@/shared/lib/correlation";

export interface ActionRequestInput {
  env: BackendEnvironment;
  path: string;
  method: HttpMethod;
  token?: string;
  params?: Record<string, string>;
  data?: unknown;
  signal?: AbortSignal;
}

/**
 * Normalized outcome of a single backend request. `needs-auth` means the
 * request was rejected for authentication (401/403) and should prompt JIT
 * re-authentication; `failure` carries a structured {@link FailureClassification}.
 */
export type ActionResult =
  | {
      status: "success";
      statusCode: number;
      data?: unknown;
      correlation: CorrelationInfo;
    }
  | { status: "needs-auth"; correlation: CorrelationInfo }
  | {
      status: "failure";
      classification: FailureClassification;
      statusCode?: number;
      message: string;
      correlation: CorrelationInfo;
    };

/** Executes a single client action against the backend. Implemented by infrastructure. */
export interface ActionRepository {
  execute(input: ActionRequestInput): Promise<ActionResult>;
}
