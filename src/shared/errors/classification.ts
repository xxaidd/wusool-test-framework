import { AppError } from "./AppError";

/**
 * Classifies an executed action outcome so normal failed business/backend
 * actions are distinct from infrastructure, validation, and authorization
 * failures (AGENTS.md §14, §23; FR-37).
 */
export type FailureClassification =
  | { kind: "success" }
  | { kind: "business" }
  | { kind: "authorization"; needsAuth: boolean }
  | { kind: "validation" }
  | {
      kind: "infrastructure";
      subtype:
        | "timeout"
        | "network"
        | "backend-unavailable"
        | "cancelled"
        | "storage";
    };

/** Classify an HTTP status from a completed backend response. */
export function classifyHttpStatus(
  status: number,
  needsAuth = false,
): FailureClassification {
  if (status === 401 || status === 403) {
    return { kind: "authorization", needsAuth };
  }
  if (status >= 400 && status < 500) return { kind: "business" };
  if (status >= 500)
    return { kind: "infrastructure", subtype: "backend-unavailable" };
  return { kind: "success" };
}

/** Classify an unknown/thrown error. Never swallows or returns generic. */
export function classifyError(err: unknown): FailureClassification {
  if (err instanceof AppError) {
    switch (err.code) {
      case "AUTHENTICATION":
        return { kind: "authorization", needsAuth: true };
      case "VALIDATION":
        return { kind: "validation" };
      case "BACKEND_UNAVAILABLE":
      case "ENVIRONMENT":
        return { kind: "infrastructure", subtype: "backend-unavailable" };
      case "ACTION_EXECUTION":
        return { kind: "business" };
      default:
        break;
    }
  }
  if (isAbortError(err))
    return { kind: "infrastructure", subtype: "cancelled" };
  if (isTimeout(err)) return { kind: "infrastructure", subtype: "timeout" };
  if (isNetworkError(err))
    return { kind: "infrastructure", subtype: "backend-unavailable" };
  return { kind: "infrastructure", subtype: "network" };
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

function isTimeout(err: unknown): boolean {
  return (
    err instanceof Error &&
    /timeout|timed out|ETIMEDOUT|ECONNABORTED/i.test(err.message)
  );
}

function isNetworkError(err: unknown): boolean {
  return (
    err instanceof Error &&
    /network|ECONNREFUSED|ENOTFOUND|failed to fetch|ERR_INTERNET/i.test(
      err.message,
    )
  );
}
