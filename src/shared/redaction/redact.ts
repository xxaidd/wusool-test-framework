/**
 * Centralized sanitization/redaction rules. Applied at every persistence
 * boundary (session events, exports, BFF responses) so no secret can reach
 * stored evidence. Pure and framework-free.
 */

/** Value used in place of any sensitive field value. */
export const REDACTED = "••••••••";

const SENSITIVE_KEY =
  /password|passwd|token|secret|credential|authorization|api[_-]?key|set-cookie|cookie|session/i;

/** Whether a field/header name should be treated as sensitive. */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

/**
 * Recursively redacts the values of every sensitive key in an object/array.
 * Leaves numbers, booleans, and plain strings intact. Idempotent.
 */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value != null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = isSensitiveKey(key) ? REDACTED : redact(item);
    }
    return out;
  }
  return value;
}

/** Redacts header values whose names look sensitive. */
export function redactHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    out[name] = isSensitiveKey(name) ? REDACTED : value;
  }
  return out;
}

export interface RedactableRequest {
  method?: string;
  path?: string;
  url?: string;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface RedactableResponse {
  statusCode?: number;
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
}

/** A request reduced to a safe, evidence-ready shape. */
export interface SanitizedRequest {
  method: string;
  path: string;
  query?: Record<string, string>;
  headers: Record<string, string>;
  body?: string;
}

/** A response reduced to a safe, evidence-ready shape. */
export interface SanitizedResponse {
  statusCode: number;
  headers: Record<string, string>;
  body?: string;
}

/** Sanitize a request so it is safe to persist/export. */
export function redactRequest(req: RedactableRequest): SanitizedRequest {
  return {
    method: req.method ?? "",
    path: req.path ?? req.url ?? "",
    ...(req.query != null ? { query: redactQuery(req.query) } : {}),
    headers: redactHeaders(req.headers ?? {}),
    ...(req.body != null ? { body: redactStringifiedBody(req.body) } : {}),
  };
}

/** Sanitize a response so it is safe to persist/export. */
export function redactResponse(res: RedactableResponse): SanitizedResponse {
  return {
    statusCode: res.statusCode ?? res.status ?? 0,
    headers: redactHeaders(res.headers ?? {}),
    ...(res.body != null ? { body: redactStringifiedBody(res.body) } : {}),
  };
}

/** Serialize a body (already JSON, object, or unknown) with secrets redacted. */
export function redactStringifiedBody(body: unknown): string {
  if (typeof body === "string") {
    try {
      return JSON.stringify(redact(JSON.parse(body)), null, 2);
    } catch {
      return body;
    }
  }
  return JSON.stringify(redact(body), null, 2);
}

function redactQuery(
  query: Record<string, string | number | boolean | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue;
    out[key] = isSensitiveKey(key) ? REDACTED : String(value);
  }
  return out;
}
