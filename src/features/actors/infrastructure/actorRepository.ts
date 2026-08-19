import type {
  DiscoverActorsInput,
  DiscoverActorsResult,
  SafeActor,
} from "@/features/actors/application/ActorRepository";
import type {
  ActorRef,
  CreateActorInput,
} from "@/features/actors/domain/actor.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BffError, bffRequest, envRef } from "@/infrastructure/bff/client";
import { envPresets } from "@/infrastructure/configuration/environments";
import { AppError } from "@/shared/errors";

/**
 * Discover existing actors from the backend through the BFF. The backend is
 * queried server-side with the admin token resolved from the vault; only safe
 * actor references are returned to the browser. This is the port adapter for
 * {@link ActorRepository.discover}: it takes {@link DiscoverActorsInput} and
 * returns a {@link DiscoverActorsResult} so the caller never touches raw BFF
 * or backend details.
 */
export async function discoverActors(
  input: DiscoverActorsInput,
): Promise<DiscoverActorsResult> {
  const env = envPresets.find((preset) => preset.id === input.envId);
  if (!env) {
    return {
      status: "failure",
      error: new AppError(
        "ENVIRONMENT",
        `Unknown environment "${input.envId}".`,
      ),
    };
  }

  try {
    const actorRefs = await bffRequest<ActorRef[]>(
      "/api/wusool/actors/search",
      { env: envRef(env), types: input.types },
      { signal: input.signal },
    );
    const actors: SafeActor[] = actorRefs.map((actor) => ({
      id: actor.id,
      type: actor.type,
      label: actor.label,
      sublabel: actor.sublabel,
      authenticated: actor.authenticated,
      source: actor.source,
      lat: actor.lat,
      lng: actor.lng,
    }));
    return { status: "success", actors };
  } catch (err) {
    if (err instanceof BffError) {
      return {
        status: "failure",
        error: new AppError(err.code ?? "BACKEND", err.message, {
          status: err.status,
        }),
      };
    }
    return {
      status: "failure",
      error: new AppError(
        "BACKEND",
        err instanceof Error ? err.message : "Unknown error",
        { status: 0 },
      ),
    };
  }
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
