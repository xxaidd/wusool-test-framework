"use client";

import { create } from "zustand";
import type { EntityOption } from "@/features/actions/application/EntityRepository";
import type { EntityKind } from "@/features/actions/domain/action.types";

export type EntityLoadStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error"
  | "needsAuth";

/** One scoped set of supporting-entity options for the search selector. */
export interface EntityBucket {
  items: EntityOption[];
  status: EntityLoadStatus;
  hasMore: boolean;
  page: number;
  pageSize: number;
  error?: string;
  updatedAt: number;
}

interface EntityStoreState {
  /** Keyed by `entityScopeKey(kind, envId, actorId?)`. */
  buckets: Record<string, EntityBucket>;
  setBucket: (key: string, bucket: Partial<EntityBucket>) => void;
  clear: () => void;
}

/**
 * Client-side cache of backend supporting entities for the search selectors.
 * Scoped by (env, actor, kind) so results can never cross environments or
 * actor contexts. Used only for selector responsiveness — executing an
 * operation fetches fresh backend state through the action executor.
 */
export const useEntityStore = create<EntityStoreState>()((set) => ({
  buckets: {},
  setBucket: (key, bucket) =>
    set((s) => {
      const prev = s.buckets[key];
      return {
        buckets: {
          ...s.buckets,
          [key]: {
            items: bucket.items ?? prev?.items ?? [],
            status: bucket.status ?? prev?.status ?? "idle",
            hasMore: bucket.hasMore ?? prev?.hasMore ?? false,
            page: bucket.page ?? prev?.page ?? 1,
            pageSize: bucket.pageSize ?? prev?.pageSize ?? 25,
            error: bucket.error ?? prev?.error,
            updatedAt: bucket.updatedAt ?? prev?.updatedAt ?? Date.now(),
          },
        },
      };
    }),
  clear: () => set({ buckets: {} }),
}));

/** Build the scoped key for an entity bucket. */
export function entityScopeKey(
  kind: EntityKind,
  envId: string,
  actorId?: string,
): string {
  return `${kind}::${envId}::${actorId ?? "guest"}`;
}
