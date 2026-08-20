# Task 2.2 — Contract-backed supporting-entity search

## Goal
Provide searchable, paginated, **frontend-filtered** selectors backed by the real Wusool
environment for the supporting entities Passenger actions need (trips, stops, routes, and the
auth-gated booking/shift/bus kinds). Typing filters a local store of backend data; the backend is
still the source of truth (DTO-validated, paged) but is **not** hit on every keystroke.

## Why
FR-07 (supporting-entity selectors) and FR-32 (backend state precedence, cache-for-responsiveness).

## Decided approach (inherits the branch's direction)
- Browser fetches each environment's entity dataset **through the BFF** into a Zustand `entity.store`,
  scoped by `(envId, actorId, kind)` so results never cross actor/environment contexts.
- The search bar **filters client-side** over that store — no per-keystroke network call.
- BFF validates/parses backend `PagedResponse` DTOs (Zod) and maps items to safe `EntityOption`
  models (`{value, label, meta?}`); no raw backend snapshots cross to the UI.
- Pagination is a first-class contract: the loader pages until done or a documented cap; the selector
  offers "load more". No single unbounded "load everything" request.
- Auth-gated kinds (trip/booking/shift) resolve the **selected actor's** token server-side; when absent
  the BFF returns `needsAuth`. The framework/admin identity is never used (pitfall).
- Executing an operation still fetches fresh backend state via the existing executor (FR-32); the
  search store is selector-only.

## Architecture
```
SearchSelect (client-side filter + load-more, states)      shared/components
   ↓
EntitySearchSelect → useEntitySearch hook                  features/actions/presentation
   ↓
loadEntityDataset use case → EntityRepository port         features/actions/application
   ↓
searchEntityPage (browser infra; AbortSignal+page)         features/actions/infrastructure
   ↓
BFF POST /entities/search → serverRequest {items,pagination}
   ↓
Wusool backend
```

## Files
- `src/shared/store/entity.store.ts` (+test) — buckets keyed by `(envId, actorId, kind)`; status
  (`idle|loading|ready|error|needsAuth`), `hasMore`, `page`, `clear`.
- `src/features/actions/application/EntityRepository.ts` — port: paged `EntitySearchResult`,
  `EntitySearchInput{envId,kind,page,pageSize,actorId,signal}`, `EntityOption.value/label/meta?`.
- `src/features/actions/application/loadEntityDataset.ts` (+test) — paginate-until-done use case;
  dedup by value, respects `maxItems` cap + AbortSignal.
- `src/features/actions/infrastructure/entityRepository.ts` — `searchEntityPage` → BFF.
- `src/app/api/wusool/entities/search/route.ts` (+test) — paged params, kind-specific paths/params
  (stops `/stops`; trips `/bus-trips`; booking `/user-trips/me`; shift `/shifts/me`; bus `/buses`;
  route `/routes`), token only from actor vault for auth kinds, `PagedResponse` Zod schema,
  `{items,total,page,hasMore}` (+ `needsAuth`), malformed items skipped.
- `src/infrastructure/contracts/schemas/entity.ts` — `PagedEnvelopeSchema`; widen trip name fields to
  accept localized `{en,ar}` or flat string; `tripMapper` sets `meta.routeId` and locale-aware label.
- `src/shared/components/SearchSelect.tsx` (+test) — data-driven options, client-side filter,
  loading/empty/error states, optional `hasMore`/`onLoadMore`.
- `src/features/actions/presentation/EntitySearchSelect.tsx` — wires hook + SearchSelect per entity
  field, optional `filterMeta` (e.g. trip filtered by chosen route).
- `src/features/actions/presentation/ActionPanel.tsx` — use `EntitySearchSelect` for entity fields.
- `src/shared/store/environmentSwitch.ts` — clear entity store on environment switch.
- i18n `en.ts`/`ar.ts` — `entities.searchError`, `entities.loadMore`, `entities.noMore`.

## Testing
- Unit/use case: pagination + dedup + cap, AbortSignal, malformed DTO skip, needsAuth (no admin),
  empty result, `meta` mapping.
- Store: status lifecycle, env/actor/kind scoping, `clear`.
- Component: client-side filtering (asserts no extra backend call on typing via injected loader count),
  load-more, empty/loading/error.
- Route/BFF integration: query/pagination encoding, needsAuth for trip/booking without actor token,
  paged-envelope parsing, stale-env rejection (env resolved from request; key scoping).

## Acceptance criteria
- Tester selects a specific real entity (search + pagination).
- Results never cross actor/environment contexts (key scoping + generation guard + actor-only token).
- No single unbounded "load everything" request (paged loader with cap; client-side filter).

## Verification
`bun run lint`, `bun run typecheck`, `bun run test`, `bun run audit:boundaries`.

## Out of scope / deferred
- Workflow entity selectors (Task 5.3 reuses this port).
- Driver/Bus search flows beyond the existing bus/shift kinds.