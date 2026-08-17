import type { AxiosInstance } from "axios";
import axios, { AxiosError } from "axios";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "ApiError";
  }
}

function client(baseUrl: string): AxiosInstance {
  return axios.create({
    baseURL: baseUrl,
    timeout: 30000,
    headers: { "Content-Type": "application/json" },
  });
}

/** Read the backend error message from an Axios failure. */
function toApiError(err: unknown): ApiError {
  if (err instanceof AxiosError) {
    const body = err.response?.data as {
      message?: string;
      errors?: { message?: string }[];
      errorCode?: string;
    };
    if (body?.message) {
      const fieldMsg =
        Array.isArray(body.errors) && body.errors[0]?.message
          ? `: ${body.errors[0].message}`
          : "";
      return new ApiError(
        err.response?.status ?? 0,
        `${body.message}${fieldMsg}`,
        body.errorCode,
      );
    }
    return new ApiError(
      err.response?.status ?? 0,
      err.message || "Network error",
    );
  }
  return new ApiError(0, err instanceof Error ? err.message : "Unknown error");
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string;
  params?: Record<string, string | number | boolean | undefined>;
  data?: unknown;
}

/**
 * Perform a request against the backend and return the unwrapped `data` payload.
 * List responses are unwrapped one level to `{ items, pagination }`.
 */
export async function apiRequest(
  env: BackendEnvironment,
  path: string,
  opts: RequestOptions = {},
): Promise<unknown> {
  const c = client(env.baseUrl);
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const cleanParams: Record<string, string> = {};
  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      if (v != null && v !== "") cleanParams[k] = String(v);
    }
  }

  try {
    const res = await c.request<unknown>({
      url: path,
      method: opts.method || "GET",
      headers,
      params: Object.keys(cleanParams).length ? cleanParams : undefined,
      data: opts.data,
    });
    return unwrap(res.data);
  } catch (err) {
    throw toApiError(err);
  }
}

function unwrap(body: unknown): unknown {
  if (body && typeof body === "object" && "data" in body) {
    return (body as { data?: unknown }).data;
  }
  return body;
}
