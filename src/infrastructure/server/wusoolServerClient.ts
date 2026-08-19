import axios, { AxiosError } from "axios";
import type { HttpMethod } from "@/features/actions/domain/action.types";
import type { Credentials } from "@/features/actors/domain/actor.types";
import type { AuthTokens } from "@/features/actors/domain/auth.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { extractExpiry } from "./jwtExpiry";

/** Header name used to propagate the framework correlation id to the backend. */
export const CORRELATION_HEADER = "x-correlation-id";
export const REQUEST_TIMEOUT_MS = 30000;

export interface ServerRequestOptions {
  method?: HttpMethod;
  token?: string;
  params?: Record<string, string | number | boolean | undefined>;
  data?: unknown;
  signal?: AbortSignal;
  correlationId?: string;
}

export interface ServerResponseData {
  status: number;
  data: unknown;
  headers: Record<string, string>;
}

/** Structured failure thrown by the server-side Wusool client. */
export class ServerApiError extends Error {
  status: number;
  code?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Backend trace id from `ErrorResponse.traceId` (correlation seed). */
  traceId?: string;
  /** Backend request path from `ErrorResponse.path`. */
  path?: string;

  constructor(
    status: number,
    message: string,
    code?: string,
    body?: unknown,
    headers?: Record<string, string>,
    traceId?: string,
    path?: string,
  ) {
    super(message);
    this.name = "ServerApiError";
    this.status = status;
    this.code = code;
    this.body = body;
    this.headers = headers;
    this.traceId = traceId;
    this.path = path;
  }
}

const TRACE_HEADERS = [
  "x-request-id",
  "x-trace-id",
  "trace-id",
  "request-id",
  "x-amzn-requestid",
  "x-correlation-id",
];

/** Best-effort capture of the backend's own trace identifier. */
export function extractTraceId(
  headers: Record<string, string>,
  body: unknown,
): string | undefined {
  for (const name of TRACE_HEADERS) {
    const value = headers[name] ?? headers[name.toLowerCase()];
    if (typeof value === "string" && value) return value;
  }
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    for (const key of ["traceId", "trace_id", "requestId", "request_id"]) {
      const value = record[key];
      if (typeof value === "string" && value) return value;
    }
  }
  return undefined;
}

function readErrorMessage(body: unknown): {
  message?: string;
  code?: string;
} {
  if (body && typeof body === "object") {
    const record = body as {
      message?: unknown;
      title?: unknown;
      errorCode?: unknown;
      errors?: { message?: unknown }[] | null;
    };
    const fieldMessage =
      Array.isArray(record.errors) && record.errors[0]?.message
        ? `: ${record.errors[0].message}`
        : "";
    const message =
      typeof record.message === "string"
        ? record.message
        : typeof record.title === "string"
          ? record.title
          : undefined;
    return {
      message: message ? `${message}${fieldMessage}` : undefined,
      code: typeof record.errorCode === "string" ? record.errorCode : undefined,
    };
  }
  return {};
}

/**
 * Extract the correlation seed fields (`traceId`, `path`) from an
 * `ErrorResponse`-shaped body. There is no dedicated correlation header
 * contract; `ErrorResponse.traceId` is the documented trace identifier.
 */
export function parseErrorTraceAndPath(body: unknown): {
  traceId?: string;
  path?: string;
} {
  if (!body || typeof body !== "object") return {};
  const record = body as { traceId?: unknown; path?: unknown };
  const readString = (value: unknown): string | undefined =>
    typeof value === "string" && value ? value : undefined;
  return {
    traceId: readString(record.traceId),
    path: readString(record.path),
  };
}

function toServerError(err: unknown): never {
  if (err instanceof AxiosError) {
    if (axios.isCancel(err) || err.code === "ERR_CANCELED") {
      throw new DOMException("The request was aborted.", "AbortError");
    }
    const body = err.response?.data;
    const parsed = readErrorMessage(body);
    const { traceId, path } = parseErrorTraceAndPath(body);
    throw new ServerApiError(
      err.response?.status ?? 0,
      parsed.message ?? err.message ?? "Network error",
      parsed.code,
      body,
      err.response?.headers as Record<string, string> | undefined,
      traceId,
      path,
    );
  }
  if (err instanceof Error) throw new ServerApiError(0, err.message);
  throw new ServerApiError(0, "Unknown error");
}

function unwrap(body: unknown): unknown {
  if (body && typeof body === "object" && "data" in body) {
    return (body as { data?: unknown }).data;
  }
  return body;
}

/**
 * Server-only Wusool HTTP client. Never import from client code; it is used
 * exclusively by Next route handlers behind the BFF boundary.
 */
export async function serverRequest(
  env: BackendEnvironment,
  path: string,
  opts: ServerRequestOptions = {},
): Promise<ServerResponseData> {
  const client = axios.create({
    baseURL: env.baseUrl,
    timeout: REQUEST_TIMEOUT_MS,
    headers: { "Content-Type": "application/json" },
  });

  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.correlationId) headers[CORRELATION_HEADER] = opts.correlationId;

  const cleanParams: Record<string, string> = {};
  if (opts.params) {
    for (const [key, value] of Object.entries(opts.params)) {
      if (value != null && value !== "") cleanParams[key] = String(value);
    }
  }

  try {
    const res = await client.request({
      url: path,
      method: opts.method ?? "GET",
      headers,
      params: Object.keys(cleanParams).length ? cleanParams : undefined,
      data: opts.data,
      signal: opts.signal,
    });
    return {
      status: res.status,
      data: unwrap(res.data),
      headers: res.headers as Record<string, string>,
    };
  } catch (err) {
    toServerError(err);
  }
}

/** Probe a backend root URL for reachability without unwrapping or throwing. */
export async function serverProbe(baseUrl: string): Promise<{
  ok: boolean;
  status: number;
}> {
  try {
    const res = await axios.get(`${baseUrl.replace(/\/$/, "")}/`, {
      timeout: 10000,
    });
    return { ok: res.status >= 200 && res.status < 300, status: res.status };
  } catch (err) {
    if (err instanceof AxiosError && err.response) {
      return { ok: false, status: err.response.status };
    }
    return { ok: false, status: 0 };
  }
}

/** Authenticate a passenger or driver against the backend. */
export async function serverLogin(
  env: BackendEnvironment,
  creds: Credentials,
  isDriver = false,
): Promise<AuthTokens> {
  const data = await serverRequest(
    env,
    isDriver ? "/api/v1/auth/driver/login" : "/api/v1/auth/login",
    { method: "POST", data: creds },
  );
  const body = data.data as {
    accessToken?: unknown;
    token?: unknown;
    refreshToken?: unknown;
    tokenType?: unknown;
  };
  const readString = (value: unknown): string | undefined =>
    typeof value === "string" && value ? value : undefined;
  const accessToken = readString(body.accessToken ?? body.token) ?? "";
  return {
    accessToken,
    refreshToken: readString(body.refreshToken),
    tokenType: readString(body.tokenType),
    expiresAt: extractExpiry(accessToken),
  };
}

/**
 * Refresh an access token using its refresh token. Parsed defensively so
 * both rotation (`accessToken` + new `refreshToken`) and non-rotating
 * responses are handled. Throws {@link ServerApiError} on failure.
 */
export async function serverRefresh(
  env: BackendEnvironment,
  refreshToken: string,
): Promise<AuthTokens> {
  const data = await serverRequest(env, "/api/v1/auth/refresh", {
    method: "POST",
    data: { refreshToken },
  });
  const body = data.data as {
    accessToken?: unknown;
    token?: unknown;
    refreshToken?: unknown;
    tokenType?: unknown;
  };
  const readString = (value: unknown): string | undefined =>
    typeof value === "string" && value ? value : undefined;
  const accessToken = readString(body.accessToken ?? body.token) ?? "";
  return {
    accessToken,
    refreshToken: readString(body.refreshToken),
    tokenType: readString(body.tokenType),
    expiresAt: extractExpiry(accessToken),
  };
}

/** Register a passenger and return the resulting tokens and user id. */
export async function serverRegister(
  env: BackendEnvironment,
  input: { email: string; password: string; fullName?: string },
): Promise<{ tokens: AuthTokens; userId?: string }> {
  const data = await serverRequest(env, "/api/v1/auth/register", {
    method: "POST",
    data: {
      email: input.email,
      password: input.password,
      confirmPassword: input.password,
      fullName: input.fullName,
    },
  });
  const body = data.data as {
    accessToken?: unknown;
    token?: unknown;
    refreshToken?: unknown;
    user?: { userId?: unknown } | null;
  };
  const readString = (value: unknown): string | undefined =>
    typeof value === "string" && value ? value : undefined;
  const accessToken = readString(body.accessToken ?? body.token) ?? "";
  return {
    tokens: {
      accessToken,
      refreshToken: readString(body.refreshToken),
      expiresAt: extractExpiry(accessToken),
    },
    userId: readString(body.user?.userId),
  };
}
