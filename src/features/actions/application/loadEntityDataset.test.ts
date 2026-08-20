import { describe, expect, it, vi } from "vitest";
import { EntityKind } from "../domain/action.types";
import type {
  EntityRepository,
  EntitySearchInput,
  EntitySearchResult,
} from "./EntityRepository";
import { DEFAULT_DATASET_MAX, loadEntityDataset } from "./loadEntityDataset";

function page(
  values: number[],
  overrides: Partial<EntitySearchResult> = {},
): EntitySearchResult {
  return {
    items: values.map((v) => ({ value: String(v), label: `item ${v}` })),
    page: 1,
    pageSize: 2,
    total: 0,
    hasMore: false,
    ...overrides,
  };
}

const input: EntitySearchInput = {
  envId: "local",
  kind: EntityKind.Stop,
  page: 1,
  pageSize: 2,
};

describe("loadEntityDataset", () => {
  it("pages until there are no more pages", async () => {
    const repo: EntityRepository = {
      search: vi
        .fn()
        .mockResolvedValueOnce(
          page([1, 2], { total: 4, hasMore: true, page: 1 }),
        )
        .mockResolvedValueOnce(
          page([3, 4], { total: 4, hasMore: false, page: 2 }),
        ),
    };

    const result = await loadEntityDataset(repo, input);

    expect(result.items.map((i) => i.value)).toEqual(["1", "2", "3", "4"]);
    expect(result.hasMore).toBe(false);
    expect(repo.search).toHaveBeenCalledTimes(2);
  });

  it("dedupes items by value across pages", async () => {
    const repo: EntityRepository = {
      search: vi
        .fn()
        .mockResolvedValueOnce(page([1, 2], { hasMore: true, total: 3 }))
        .mockResolvedValueOnce(page([1, 3], { hasMore: false, total: 3 })),
    };

    const result = await loadEntityDataset(repo, input);

    expect(result.items.map((i) => i.value)).toEqual(["1", "2", "3"]);
  });

  it("stops at the maxItems cap and reports hasMore", async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce(
        page([1, 2], { hasMore: true, total: 1000, page: 1 }),
      )
      .mockResolvedValueOnce(
        page([3, 4], { hasMore: true, total: 1000, page: 2 }),
      );
    const repo: EntityRepository = { search };

    const result = await loadEntityDataset(repo, input, { maxItems: 4 });

    expect(result.items).toHaveLength(4);
    expect(result.hasMore).toBe(true);
    // Ceased paging at the cap, not at exhaustion.
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("forwards the abort signal to the repository", async () => {
    const signal = new AbortController().signal;
    const repo: EntityRepository = {
      search: vi.fn().mockResolvedValue(page([1], { hasMore: false })),
    };

    await loadEntityDataset(repo, input, { signal });

    expect(repo.search).toHaveBeenCalledWith(
      expect.objectContaining({ signal, page: 1 }),
    );
  });

  it("propagates needsAuth from a gated kind", async () => {
    const repo: EntityRepository = {
      search: vi
        .fn()
        .mockResolvedValueOnce(page([], { needsAuth: true, hasMore: false })),
    };

    const result = await loadEntityDataset(repo, input);

    expect(result.items).toEqual([]);
    expect(result.needsAuth).toBe(true);
    expect(repo.search).toHaveBeenCalledTimes(1);
  });

  it("honours the default dataset cap", async () => {
    expect(DEFAULT_DATASET_MAX).toBeGreaterThan(0);
    const repo: EntityRepository = {
      search: vi.fn().mockImplementation(async (i: EntitySearchInput) => {
        const start = ((i.page ?? 1) - 1) * 2 + 1;
        return page([start, start + 1], { hasMore: true, total: 10_000 });
      }),
    };
    const result = await loadEntityDataset(repo, input);
    expect(result.items).toHaveLength(DEFAULT_DATASET_MAX);
    expect(result.hasMore).toBe(true);
  });

  it("stops when a page yields only already-seen items (no backtracking)", async () => {
    const repo: EntityRepository = {
      search: vi
        .fn()
        .mockResolvedValueOnce(page([1, 2], { hasMore: true, total: 100 }))
        .mockResolvedValueOnce(page([1, 2], { hasMore: true, total: 100 })),
    };

    const result = await loadEntityDataset(repo, input);

    expect(result.items.map((i) => i.value)).toEqual(["1", "2"]);
    expect(result.hasMore).toBe(false);
    expect(repo.search).toHaveBeenCalledTimes(2);
  });
});
