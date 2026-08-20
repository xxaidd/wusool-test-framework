"use client";

import { useCallback, useEffect, useRef } from "react";
import type { EntitySearchResult } from "@/features/actions/application/EntityRepository";
import { loadEntityDataset } from "@/features/actions/application/loadEntityDataset";
import type { EntityKind } from "@/features/actions/domain/action.types";
import { entityRepositoryFor } from "@/features/actions/infrastructure/entityRepository";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { entityScopeKey, useEntityStore } from "@/shared/store/entity.store";

/** True when an error is an abort caused by a superseded/unmounted load. */
export function isAbortLike(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (typeof err === "object" &&
      err != null &&
      (err as { name?: unknown }).name === "AbortError")
  );
}

export interface UseEntitySearchOptions {
  env: BackendEnvironment;
  kind: EntityKind;
  actorId?: string;
  /** When false the hook stays idle and fetches nothing. */
  enabled?: boolean;
  pageSize?: number;
  maxItems?: number;
}

/**
 * Load (and lazily refresh) the dataset for one `(env, actor, kind)` scope into
 * the entity store. Superseded loads are aborted and a generation counter
 * discards any stale in-flight response, so results never cross contexts.
 */
export function useEntitySearch({
  env,
  kind,
  actorId,
  enabled = true,
  pageSize = 25,
  maxItems = 200,
}: UseEntitySearchOptions) {
  const key = entityScopeKey(kind, env.id, actorId);
  const bucket = useEntityStore((s) => s.buckets[key]);
  const setBucket = useEntityStore((s) => s.setBucket);

  const abortRef = useRef<AbortController | null>(null);
  const genRef = useRef(0);

  const fetchInto = useCallback(
    async (startPage: number) => {
      const controller = new AbortController();
      abortRef.current?.abort();
      const gen = ++genRef.current;
      abortRef.current = controller;

      setBucket(key, {
        status: "loading",
        ...(startPage === 1
          ? { items: [], page: startPage, hasMore: false }
          : {}),
      });

      try {
        const repo = entityRepositoryFor(env);
        const result: EntitySearchResult = await loadEntityDataset(
          repo,
          { envId: env.id, kind, page: startPage, pageSize, actorId },
          { signal: controller.signal, maxItems, pageSize },
        );
        if (gen !== genRef.current) return;
        const prev = useEntityStore.getState().buckets[key];
        setBucket(key, {
          items:
            startPage === 1
              ? result.items
              : [...(prev?.items ?? []), ...result.items],
          status: result.needsAuth ? "needsAuth" : "ready",
          page: result.page,
          pageSize,
          hasMore: result.hasMore,
          error: undefined,
          updatedAt: Date.now(),
        });
      } catch (err) {
        if (isAbortLike(err)) return;
        if (gen !== genRef.current) return;
        setBucket(key, {
          status: "error",
          error: err instanceof Error ? err.message : "Entity search failed",
        });
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    // Scope identity is the cache key; env keeps the loader bound to the
    // resolved environment (baseUrl/id) for the current scope.
    [key, env, kind, actorId, pageSize, maxItems, setBucket],
  );

  const load = useCallback(() => fetchInto(1), [fetchInto]);

  const loadMore = useCallback(() => {
    const cur = useEntityStore.getState().buckets[key];
    if (!cur || cur.status === "loading" || !cur.hasMore) return;
    void fetchInto(cur.page + 1);
  }, [fetchInto, key]);

  useEffect(() => {
    const current = useEntityStore.getState().buckets[key];
    if (enabled && (!current || current.status === "idle")) {
      void fetchInto(1);
    }
    return () => {
      abortRef.current?.abort();
      genRef.current += 1;
      abortRef.current = null;
    };
  }, [enabled, key, fetchInto]);

  return {
    items: bucket?.items ?? [],
    status: bucket?.status ?? "idle",
    error: bucket?.error,
    hasMore: bucket?.hasMore ?? false,
    page: bucket?.page ?? 1,
    load,
    loadMore,
  };
}
