import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EntityRepository,
  EntitySearchResult,
} from "@/features/actions/application/EntityRepository";
import { EntityKind } from "@/features/actions/domain/action.types";
import {
  BackendEnvId,
  type BackendEnvironment,
} from "@/features/environments/domain/environment.types";
import { entityScopeKey, useEntityStore } from "@/shared/store/entity.store";
import { useEntitySearch } from "./useEntitySearch";

const env: BackendEnvironment = {
  id: BackendEnvId.Local,
  label: "Local",
  baseUrl: "http://localhost:5002",
};

let repo: EntityRepository;
vi.mock("@/features/actions/infrastructure/entityRepository", () => ({
  entityRepositoryFor: () => repo,
  searchEntityPage: vi.fn(),
}));

function resultPage(...values: string[]): EntitySearchResult {
  return {
    items: values.map((v) => ({ value: v, label: `item ${v}` })),
    page: 1,
    pageSize: 25,
    total: values.length,
    hasMore: false,
  };
}

describe("useEntitySearch", () => {
  beforeEach(() => {
    useEntityStore.getState().clear();
  });

  it("loads the scope into the store and exposes ready items", async () => {
    repo = {
      search: vi.fn().mockResolvedValue(resultPage("1", "2")),
    };

    const { result } = renderHook(() =>
      useEntitySearch({ env, kind: EntityKind.Stop, actorId: "7" }),
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.items.map((i) => i.value)).toEqual(["1", "2"]);
    expect(
      useEntityStore.getState().buckets[
        entityScopeKey(EntityKind.Stop, "local", "7")
      ]?.status,
    ).toBe("ready");
  });

  it("scopes data so results never cross actor contexts", async () => {
    repo = {
      search: vi.fn().mockResolvedValue(resultPage("a")),
    };

    const { result: a } = renderHook(() =>
      useEntitySearch({ env, kind: EntityKind.Stop, actorId: "7" }),
    );
    repo = {
      search: vi.fn().mockResolvedValue(resultPage("b")),
    };
    const { result: b } = renderHook(() =>
      useEntitySearch({ env, kind: EntityKind.Stop, actorId: "8" }),
    );

    await waitFor(() => expect(a.current.status).toBe("ready"));
    await waitFor(() => expect(b.current.status).toBe("ready"));

    const keyA = entityScopeKey(EntityKind.Stop, "local", "7");
    const keyB = entityScopeKey(EntityKind.Stop, "local", "8");
    expect(useEntityStore.getState().buckets[keyA].items[0].value).toBe("a");
    expect(useEntityStore.getState().buckets[keyB].items[0].value).toBe("b");
  });

  it("exposes needsAuth status for a gated kind", async () => {
    repo = {
      search: vi.fn().mockResolvedValue({ ...resultPage(), needsAuth: true }),
    };

    const { result } = renderHook(() =>
      useEntitySearch({ env, kind: EntityKind.Booking, actorId: "7" }),
    );
    await waitFor(() => expect(result.current.status).toBe("needsAuth"));
  });

  it("loadMore appends the next page and updates hasMore", async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ value: "1", label: "one" }],
        page: 1,
        pageSize: 1,
        total: 2,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        items: [{ value: "2", label: "two" }],
        page: 2,
        pageSize: 1,
        total: 2,
        hasMore: false,
      });
    repo = { search };

    const { result } = renderHook(() =>
      useEntitySearch({
        env,
        kind: EntityKind.Stop,
        actorId: "7",
        pageSize: 1,
        maxItems: 1,
      }),
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.items).toHaveLength(1);

    act(() => void result.current.loadMore());
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.hasMore).toBe(false);
  });
});
