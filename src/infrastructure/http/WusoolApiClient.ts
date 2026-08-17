import type { AxiosInstance } from "axios";
import axios, { AxiosError } from "axios";
import type { HttpMethod } from "@/features/actions/domain/action.types";
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
  method?: HttpMethod;
  token?: string;
  params?: Record<string, string | number | boolean | undefined>;
  data?: unknown;
  signal?: AbortSignal;
}

interface ResponseData {
  status: number;
  data: unknown;
}

/** Perform a request and return `{ status, data }` with the `data` payload unwrapped. */
async function request(
  env: BackendEnvironment,
  path: string,
  opts: RequestOptions = {},
): Promise<ResponseData> {
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
      signal: opts.signal,
    });
    return { status: res.status, data: unwrap(res.data) };
  } catch (err) {
    throw toApiError(err);
  }
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
  const { data } = await request(env, path, opts);
  return data;
}

/** Like {@link apiRequest} but also exposes the HTTP status code. */
export async function apiRequestDetailed(
  env: BackendEnvironment,
  path: string,
  opts: RequestOptions = {},
): Promise<ResponseData> {
  return request(env, path, opts);
}

/** Probe a backend root URL for reachability without unwrapping or throwing. */
export async function probe(baseUrl: string): Promise<{
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

function unwrap(body: unknown): unknown {
  if (body && typeof body === "object" && "data" in body) {
    return (body as { data?: unknown }).data;
  }
  return body;
}
