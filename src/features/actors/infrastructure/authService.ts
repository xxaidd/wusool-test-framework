import type { Credentials } from "@/features/actors/domain/actor.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { bffRequest, envRef } from "@/infrastructure/bff/client";

/**
 * JIT authentication against the backend. Tokens are stored in the
 * server-side vault keyed by `(actorId, env)`; nothing sensitive is returned.
 */
export async function login(
  env: BackendEnvironment,
  creds: Credentials,
  isDriver: boolean,
  actorId: string,
): Promise<void> {
  await bffRequest("/api/wusool/auth/login", {
    env: envRef(env),
    actorId,
    email: creds.email,
    password: creds.password,
    isDriver,
  });
}
