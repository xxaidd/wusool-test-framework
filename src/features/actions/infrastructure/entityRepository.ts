import type {
  EntityRepository,
  EntitySearchResult,
} from "@/features/actions/application/EntityRepository";
import type { EntityKind } from "@/features/actions/domain/action.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { bffRequest, envRef } from "@/infrastructure/bff/client";

export interface SearchEntityQuery {
  env: BackendEnvironment;
  kind: EntityKind;
  actorId?: string;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}

/**
 * Request one page of backend entities from the BFF. Auth-gated kinds
 * (booking/shift/trip) resolve the actor's own token server-side; the
 * framework identity is never used.
 */
export async function searchEntityPage(
  q: SearchEntityQuery,
): Promise<EntitySearchResult> {
  return bffRequest<EntitySearchResult>(
    "/api/wusool/entities/search",
    {
      env: envRef(q.env),
      ...(q.actorId ? { actorId: q.actorId } : {}),
      kind: q.kind,
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 25,
    },
    { signal: q.signal },
  );
}

/** Application-port adapter that binds the repo to a concrete environment. */
export function entityRepositoryFor(env: BackendEnvironment): EntityRepository {
  return {
    search: (input) =>
      searchEntityPage({
        env,
        kind: input.kind,
        actorId: input.actorId,
        page: input.page,
        pageSize: input.pageSize,
        signal: input.signal,
      }),
  };
}
