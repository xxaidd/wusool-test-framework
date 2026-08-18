import type {
  ActorRef,
  ActorType,
  CreateActorInput,
} from "@/features/actors/domain/actor.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { bffRequest, envRef } from "@/infrastructure/bff/client";

/**
 * Discover existing actors from the backend through the BFF. The backend is
 * queried server-side with the admin token; only safe actor references are
 * returned to the browser.
 */
export async function discoverActors(
  env: BackendEnvironment,
  adminToken: string,
  types: ActorType[],
): Promise<ActorRef[]> {
  return bffRequest("/api/wusool/actors/search", {
    env: envRef(env),
    adminToken,
    types,
  });
}

/** Create a test actor through the BFF. Passengers authenticate immediately. */
export async function createActor(
  env: BackendEnvironment,
  adminToken: string,
  input: CreateActorInput,
): Promise<ActorRef> {
  return bffRequest("/api/wusool/actors", {
    env: envRef(env),
    adminToken,
    input,
  });
}
