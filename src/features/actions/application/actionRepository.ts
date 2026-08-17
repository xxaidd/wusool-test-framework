import type { HttpMethod } from "@/features/actions/domain/action.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";

export interface ActionRequestInput {
  env: BackendEnvironment;
  path: string;
  method: HttpMethod;
  token?: string;
  params?: Record<string, string>;
  data?: unknown;
  signal?: AbortSignal;
}

export type ActionRepositoryResult =
  | { ok: true; status: number; data?: unknown }
  | { ok: false; status: number; error: string };

/** Executes a single client action against the backend. Implemented by infrastructure. */
export interface ActionRepository {
  execute(input: ActionRequestInput): Promise<ActionRepositoryResult>;
}
