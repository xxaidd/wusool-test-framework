import axios, { AxiosError } from "axios";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";

/** Structured failure raised by the browser-side BFF client. */
export class BffError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "BffError";
  }
}

/** Whether an error means the admin/session-manager auth must be configured. */
export function isAdminAuthRequired(err: unknown): boolean {
  return (
    (err instanceof BffError && err.code === "ADMIN_AUTH_REQUIRED") ||
    (typeof err === "object" &&
      err != null &&
      (err as { code?: unknown }).code === "ADMIN_AUTH_REQUIRED")
  );
}

/** Browser-sent environment reference (custom URLs validated server-side). */
export function envRef(env: BackendEnvironment): {
  envId: string;
  baseUrl?: string;
} {
  return { envId: env.id, baseUrl: env.custom ? env.baseUrl : undefined };
}

/** Reduce an actor to its safe reference, excluding credentials/tokens/raw. */
export function safeActor(actor: ActorRef): {
  id: string;
  type: ActorRef["type"];
  label: string;
  sublabel?: string;
  source: ActorRef["source"];
  authenticated: boolean;
} {
  return {
    id: actor.id,
    type: actor.type,
    label: actor.label,
    ...(actor.sublabel ? { sublabel: actor.sublabel } : {}),
    source: actor.source,
    authenticated: actor.authenticated,
  };
}

export interface BffEnvelope<T> {
  ok: true;
  data: T;
}

export interface BffFailureEnvelope {
  ok: false;
  error: { code?: string; message?: string };
}

type Envelope<T> = BffEnvelope<T> | BffFailureEnvelope;

function isEnvelope(value: unknown): value is Envelope<unknown> {
  return (
    typeof value === "object" &&
    value != null &&
    "ok" in value &&
    typeof (value as { ok: unknown }).ok === "boolean"
  );
}

/**
 * Browser-side client for the Wusool BFF. All backend traffic flows through
 * these route handlers; no direct `fetch`/axios call may reach the backend.
 * Errors are normalized to {@link BffError} and cancellations to `AbortError`.
 */
export async function bffRequest<T>(
  path: string,
  body: unknown,
  opts: { signal?: AbortSignal } = {},
): Promise<T> {
  try {
    const res = await axios.post(path, body, {
      signal: opts.signal,
      headers: { "Content-Type": "application/json" },
    });
    const payload: unknown = res.data;
    if (isEnvelope(payload)) {
      if (!payload.ok) {
        const err = payload.error;
        throw new BffError(
          res.status,
          err?.message ?? "BFF request failed",
          err?.code,
        );
      }
      return payload.data as T;
    }
    return payload as T;
  } catch (err) {
    if (err instanceof BffError) throw err;
    if (err instanceof AxiosError) {
      if (axios.isCancel(err) || err.code === "ERR_CANCELED") {
        throw new DOMException("The request was aborted.", "AbortError");
      }
      const data = err.response?.data as
        | { error?: { code?: string; message?: string } }
        | undefined;
      throw new BffError(
        err.response?.status ?? 0,
        data?.error?.message ?? err.message ?? "Network error",
        data?.error?.code,
      );
    }
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new BffError(0, err instanceof Error ? err.message : "Unknown error");
  }
}
