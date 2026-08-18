import type {
  ActorRef,
  ActorType,
  CreateActorInput,
} from "@/features/actors/domain/actor.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { bffRequest, envRef } from "@/infrastructure/bff/client";

/**
 * Discover existing actors from the backend through the BFF. The backend is
 * queried server-side with the admin token resolved from the vault; only safe
 * actor references are returned to the browser.
 */
export async function discoverActors(
  env: BackendEnvironment,
  types: ActorType[],
): Promise<ActorRef[]> {
  return bffRequest("/api/wusool/actors/search", {
    env: envRef(env),
    types,
  });
}

/** Create a test actor through the BFF. Passengers authenticate immediately. */
export async function createActor(
  env: BackendEnvironment,
  input: CreateActorInput,
): Promise<ActorRef> {
  return bffRequest("/api/wusool/actors", {
    env: envRef(env),
    input,
  });
}

export type AdminLoginInput =
  | { mode: "credentials"; email: string; password: string }
  | { mode: "token"; token: string };

/**
 * Configure the admin/session-manager auth for an environment through the
 * BFF. Tokens are stored server-side; the response carries no secrets.
 */
export async function configureAdmin(
  env: BackendEnvironment,
  input: AdminLoginInput,
): Promise<void> {
  await bffRequest("/api/wusool/admin/login", {
    env: envRef(env),
    ...input,
  });
}
