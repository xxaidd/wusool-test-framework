import type { EntityKind } from "@/features/actions/domain/action.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { bffRequest, envRef } from "@/infrastructure/bff/client";

export interface EntityOption {
  value: string;
  label: string;
  raw?: Record<string, unknown>;
}

/**
 * Search backend entities for action form fields. Auth-required entity kinds
 * (booking/shift) are resolved server-side from the actor's vault context.
 */
export async function loadEntity(
  env: BackendEnvironment,
  kind: EntityKind,
  query: string,
  actorId?: string,
): Promise<EntityOption[]> {
  return bffRequest("/api/wusool/entities/search", {
    env: envRef(env),
    actorId,
    kind,
    query,
  });
}
