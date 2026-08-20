import type {
  EntityRepository,
  EntitySearchInput,
  EntitySearchResult,
} from "./EntityRepository";

export interface LoadDatasetOptions {
  /** Hard cap on items kept in the store (prevents unbounded loading). */
  maxItems?: number;
  pageSize?: number;
  signal?: AbortSignal;
}

export const DEFAULT_DATASET_MAX = 200;

/**
 * Paginate through the backend entity repository until there are no more pages
 * or {@link LoadDatasetOptions.maxItems maxItems} is reached. Items are deduped
 * by `value`. Returns the assembled page with page metadata so a load-more can
 * continue from the last page.
 */
export async function loadEntityDataset(
  repo: EntityRepository,
  input: EntitySearchInput,
  opts: LoadDatasetOptions = {},
): Promise<EntitySearchResult> {
  const maxItems = opts.maxItems ?? DEFAULT_DATASET_MAX;
  const pageSize = opts.pageSize ?? input.pageSize ?? 20;

  const collected: EntitySearchResult["items"] = [];
  const seen = new Set<string>();
  let page = input.page > 0 ? input.page : 1;
  let total = 0;
  let needsAuth: boolean | undefined;
  let capped = false;

  for (;;) {
    const batch = await repo.search({
      ...input,
      page,
      pageSize,
      signal: opts.signal,
    });
    if (batch.needsAuth) {
      needsAuth = batch.needsAuth;
      break;
    }
    total = batch.total;
    const before = collected.length;
    for (const item of batch.items) {
      if (seen.has(item.value)) continue;
      seen.add(item.value);
      collected.push(item);
    }
    // A page that yields no new items signals exhaustion (dupes only). Stop
    // rather than looping forever on a backend that repeats page content.
    if (collected.length === before) break;
    // When the backend reports no further pages, the dataset is fully loaded
    // (even if it reached the cap) — report hasMore=false.
    if (!batch.hasMore) break;
    if (collected.length >= maxItems) {
      capped = true;
      break;
    }
    page += 1;
  }

  return {
    items: collected,
    page,
    pageSize,
    total,
    hasMore: capped,
    ...(needsAuth !== undefined ? { needsAuth } : {}),
  };
}
