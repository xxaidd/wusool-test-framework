# Task 3.3 — Build session timeline, technical inspector, and correlated-log view

## Goal
Turn session evidence into a timeline-first debugging interface: a human-readable summary
timeline with filters/search, an event inspector exposing safe technical evidence (request/
response headers + bodies, correlation IDs, classification, timing), authorized correlated
backend-log retrieval with explicit loading/error/permission/unavailable states, and static
historical movement paths on the map (no playback).

## Why
FR-45–48 and AGENTS.md §21. Current state after Tasks 3.1–3.2:

- `SessionPanel` (`src/features/sessions/presentation/SessionPanel.tsx`) already renders a basic
  timeline (time, source, status dot, `actorLabel · summary`, method/status) and a detail `Modal`
  showing status/error/request/response **bodies only**. It does not show headers, correlation IDs
  (`requestId`/`executionId`/`correlationId`/`traceId`), classification, or logs; there are no
  filters/search.
- The `BackendLogRepository` port exists (`src/features/sessions/application/BackendLogRepository.ts`)
  but has **no implementation and no callers**; no BFF log route; no backend log contract (flagged
  unavailable in Task 0.2).
- Session events already carry `position` + `actorId` + `seq`/`ts`, but nothing plots recorded
  positions back onto the map — the only `Polyline` in `MapCanvas` is the live drawn route.
- All tests are node-env `*.test.ts`; no jsdom/Testing Library exists (decision: add them).
- Event request/response are already sanitized at every boundary (`sessionEventFactory` applies
  `redactHeaders`/`redactStringifiedBody`), so the inspector is safe to render; only newly-fetched
  backend log content needs additional redaction.

## Architecture
```
SessionPanel ─► SessionTimeline (filters/search via pure filterSessionEvents)
                └► EventInspector (Modal) ─► CorrelatedLogs (lazy per-event fetch)
                       │
                       └► backendLogRepository (browser, BackendLogRepository port)
                              │ POST /api/wusool/logs (Zod, bounded window)
                              ▼
                       serverBackendLogRepository (unavailable-by-default until contract)

MapCanvas ─► useSessionStore.events ─► buildStaticPaths (pure) ─► dashed Leaflet Polyline
```

- Timeline filtering and static-path building are pure framework-free helpers in the sessions
  feature (unit-testable, audit-clean).
- The browser log client implements the `BackendLogRepository` port; the BFF route validates input,
  resolves the environment, and returns sanitized entries or a typed error.
- The server repository is contract-gated: until a backend log endpoint is configured it returns an
  explicit unavailable result, so no endpoint is expanded on inference (Task 0.2).

## Changes

### Application (sessions feature — pure, framework-free)
- `src/features/sessions/application/timelineFilters.ts` (+ test) — pure
  `filterSessionEvents(events, { query, source, status })`:
  - text query matches `actorLabel`, `summary`, `actionLabel`, `actionId`, `actorId`
    case-insensitively;
  - source filter `all | manual | workflow | system`; status filter `all | success | failed | info`;
  - returns events in chronological order (`seq`), preserving immutability.
- `src/features/sessions/application/sessionPaths.ts` (+ test) — pure
  `buildStaticPaths(events): StaticPath[]`:
  - groups events that carry `position` by `actorId`, orders by `seq`, drops out-of-bounds points,
    dedupes consecutive identical points;
  - `StaticPath = { actorId, actorLabel, points: Array<{ lat: number; lng: number }> }`;
  - only paths with ≥ 2 distinct points are returned (FR-48 static movement paths).
- `src/features/sessions/application/BackendLogRepository.ts` — extend the port with a discriminated
  `LogFetchResult` (`success { entries }` | `unavailable` | `error { message }`) so the UI can render
  distinct states; `BackendLogEntry`/`BackendLogQuery` unchanged.

### Infrastructure — backend log BFF (unavailable-by-default)
- `src/features/sessions/infrastructure/serverBackendLogRepository.ts` (+ test) — server-side
  implementation of `BackendLogRepository`:
  - `createServerBackendLogRepository()` returns `fetchForCorrelation` that, when
    `process.env.WUSOOL_BACKEND_LOG_ENDPOINT` is unset, returns `{ status: "unavailable" }` — no
    endpoint guessing (Task 0.2);
  - when the endpoint is configured, calls it with the bounded window, validates entries via a Zod
    schema, redacts each `message`/`metadata` via `shared/redaction/redact.ts`, and clamps the
    result limit;
  - accepts an injected `fetcher` for deterministic tests without a real backend.
- `src/app/api/wusool/logs/route.ts` (+ test) — `POST` with a Zod schema:
  - body `{ env: envInputSchema, correlationId: string, since?: ISO, until?: ISO, limit?: number }`;
  - clamps `since`/`until` to a bounded window (default event `ts` ± 60 s, max 10 min) and `limit`
    (default 200, max 500) — bounded query windows;
  - resolves the environment via `resolveEnvironment`, calls the server repository, returns
    `ok({ entries })` or `fail(err)` (existing envelope pattern in `helpers.ts`);
  - entries validated at the boundary before returning.
- `src/features/sessions/infrastructure/backendLogRepository.ts` (+ test) — browser
  `BackendLogRepository` over `bffRequest("/api/wusool/logs", ...)`:
  - maps `BffError` to a typed `LogFetchResult` (success / unavailable / error) so the UI can show
    distinct states; propagates `AbortError` for cancellation.

### Presentation
- `src/features/sessions/presentation/SessionPanel.tsx` — split into focused components
  (AGENTS §27): keep header/controls/export/end/storage-error banner; embed `SessionTimeline`; use
  `EventInspector` instead of the inline detail `Modal`.
- `src/features/sessions/presentation/SessionTimeline.tsx` — timeline list + toolbar:
  - filters row: search `Input` (debounced via `useDeferredValue`) + two `Select`s (source, status),
    reusing shared components;
  - memoized `filterSessionEvents` over a focused subscription to `events`;
  - event row keeps the current summary presentation; the row is a focusable button (keyboard
    accessible) that opens the inspector.
- `src/features/sessions/presentation/EventInspector.tsx` — expanded detail `Modal`:
  - metadata sections: actor (id/type), action (id/category), timing (`ts`, `durationMs`), status +
    classification badge, error;
  - request section: method/url + headers + body `<pre>`; response section: status + headers + body
    `<pre>` (already sanitized in events);
  - correlation section: `requestId`, `executionId`, `correlationId`, `traceId` when present;
  - embedded `CorrelatedLogs`, lazy — only fetched when the user opens the logs section for that
    event.
- `src/features/sessions/presentation/CorrelatedLogs.tsx` — log retrieval panel:
  - states: idle → loading (`Spinner`, `aria-busy`) → success (entries with `ts`/`level`/`message`,
    metadata as `pre`, redacted) | empty | unavailable (`LOG_API_UNAVAILABLE` → explanatory i18n
    message) | error | permission (401/403);
  - `AbortController` cancels on close/unmount; bounded window derived from the event `ts`.
- `src/features/map/presentation/MapCanvas.tsx` — static historical paths:
  - subscribe to `useSessionStore((s) => s.events)`, compute `buildStaticPaths(events)` (memoized);
  - render one dashed `Polyline` per path, visually distinct from the live drawn route;
  - a toolbar toggle to show/hide historical paths (default hidden; FR-48 static only, no playback).

### i18n
- `src/shared/i18n/en.ts` + `ar.ts` — new `session.*` keys: filter search/source/status labels +
  options, inspector labels (headers, correlation, requestId, executionId, correlationId, traceId,
  classification, timing), classification kind/subtype labels, log states (loadLogs, logsLoading,
  logsEmpty, logsUnavailable, logsError, logsPermission); `map.showHistoricalPaths` /
  `map.hideHistoricalPaths`. Follow the existing per-locale pattern (en is the source of truth, ar
  mirrors `Messages`).

### Component-test infrastructure
- Add devDependencies: `@testing-library/react`, `@testing-library/dom`,
  `@testing-library/jest-dom`, `jsdom` (reconcile `bun.lock` — preserve user-owned changes).
- `vitest.config.mts` — use Vitest 4 `projects`: a `node` project (existing include/setup) plus a
  `component` project (`environment: "jsdom"`, `include: ["src/**/*.test.tsx"]`, setup importing
  `@testing-library/jest-dom/vitest` + `fake-indexeddb/auto`). Verify the exact `projects` type in
  the installed Vitest 4.1 during implementation.

### Tests
- Unit (node): `timelineFilters.test.ts` (query/source/status filtering, ordering, immutability);
  `sessionPaths.test.ts` (grouping, bounds, dedupe, ≥2-points rule, `seq` ordering).
- BFF integration (node): `logs/route.test.ts` — Zod validation, window/limit clamping,
  unavailable envelope, configured-fetcher success with redacted entries;
  `serverBackendLogRepository.test.ts` — unavailable default, injected fetcher, redaction, limit
  clamp.
- Browser client (node, mocked `bffRequest`): `backendLogRepository.test.ts` — success/unavailable/
  error mapping, `AbortError` propagation.
- Component (jsdom + Testing Library): `SessionTimeline.test.tsx` — summaries render by default,
  filters/search narrow rows, `seq` ordering, row keyboard focus/activation;
  `EventInspector.test.tsx` — request/response headers + bodies, correlation IDs, classification,
  redaction regression (seed `token`/`authorization` values → never rendered), lazy log states;
  `CorrelatedLogs.test.tsx` — state machine, abort on unmount, log redaction.

## Decisions
- **Component-test infra added** (user decision): `@testing-library/react` + `@testing-library/dom`
  + `@testing-library/jest-dom` + `jsdom`. This modifies the user-owned `bun.lock`; reconcile, do
  not overwrite. Full E2E remains with the future runner task.
- **Logs unavailable-by-default**: full plumbing implemented; only the server call is gated behind
  `WUSOOL_BACKEND_LOG_ENDPOINT` config; the UI shows an explicit unavailable state.
- **Lazy logs**: fetched per event only when the user opens the logs section (long-term plan: lazy
  load); no timeline-wide prefetch; `AbortController` cancels on close/unmount.
- **Static paths**: hidden by default behind a map toolbar toggle; purely static (`Polyline`), no
  animation (FR-48); built by a pure helper so it is reusable by later phases.
- **No virtualization yet**: the timeline stays memoized with focused subscriptions; virtualization
  is deferred to the performance phase (Task 6.2) until measurement justifies it.
- **Boundary discipline**: pure helpers in sessions/application (no React/Zustand/browser imports —
  audit-clean); server log repository in infrastructure (server-only); browser client in feature
  infrastructure; stores stay client-side; routes stay server-side.
- **Redaction**: events are already sanitized before storage; the only new untrusted surface is
  backend log content, redacted at the server repository and defensively at the component.

## Verification
`bun run lint`, `bun run typecheck`, `bun run test`, `bun run audit:boundaries`, `bun run build`.
Preserve user-owned changes (`bun.lock`, `docs/`).
