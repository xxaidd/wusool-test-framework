# Task 3.1 — Implement a centralized immutable session recorder

## Goal
Create one application-level path for recording action, workflow, environment, map, and
backend-health events so that every meaningful event is emitted once, is immutable, safe to
export, and carries the trace metadata needed to join *user action → framework request →
correlation ID → backend log*.

## Why
FR-38–40 and AGENTS.md traceability requirements. Current defects:

- Components record events directly through `session.store.addEvent` (`ActionPanel.tsx`,
  `MapCanvas.tsx`, `EnvironmentModal.tsx`), each constructing events and relying on the store
  for redaction, ids, and timestamps. There is no single application path.
- The `SessionRecorder` port exists (`src/features/sessions/application/SessionRecorder.ts`) but
  has no implementation and no callers.
- `SessionEvent` carries no `requestId`, `executionId`, `correlationId`, `traceId`, or
  `FailureClassification`, so recorded events cannot be joined to backend requests/logs, and
  normal failed business actions are indistinguishable from infrastructure failures.
- `ActionOutcome` does not expose a `FailureClassification`, so failure type cannot be recorded.
- Event ids/timestamps are ad-hoc and ordering under concurrent manual/workflow actions is
  undefined (no monotonic sequence).
- Cancellations (`AbortError`) are silently dropped and never appear in the session.

## Current state (after Phases 0–1 and Tasks 2.1–2.3)
- All Wusool traffic is BFF-mediated; `POST /api/wusool/actions/execute` generates
  `correlationId = createId("req")` and returns sanitized request/response + correlation
  (`ExecuteEnvelope`).
- `runAction` shapes a normalized `ActionOutcome` (ok, needsAuth, statusCode, data, error,
  durationMs, correlation, request, response, position).
- `ExecutionRecord` evidence type exists (`evidence.types.ts`) but nothing produces it.
- `SessionRecorder` port declares `start`/`record`/`stop`; `RecordEventInput` accepts an optional
  `execution?: ExecutionRecord`.
- `session.store.ts` owns event construction + redaction + id/timestamp generation + gating;
  components call `addEvent` directly.
- Pure building blocks exist: `createId` (`shared/lib/ids.ts`), redaction
  (`shared/redaction/redact.ts`), `FailureClassification` (`shared/errors/classification.ts`).

## Architecture
```
ActionPanel ─ runAction({ recorder, summary }) ─► buildExecutionRecord ─► ExecutionRecord
MapCanvas / EnvironmentModal ─► sessionRecorder.record({ source: System, ... })      │
                                                                                     ▼
      SessionRecorder (port, application) ◄─ concrete sessionRecorder (shared/store)
                                                                                     │
                                              sessionEventFactory (application, pure) ► SessionEvent
                                                                                     ▼
                                                                   useSessionStore.appendEvent
```

- `runAction` (application) depends only on the `SessionRecorder` *port type*; the concrete
  store-backed implementation is supplied by the presentation layer.
- The factory and execution-record builder are pure and framework-free.

## Changes

### Domain
- `src/features/sessions/domain/session.types.ts` — add optional `seq?`, `requestId?`,
  `executionId?`, `correlationId?`, `traceId?`, `classification?` to `SessionEvent`.
  Backward-compatible: serializer/export/SessionPanel render the existing fields unchanged.

### Application (sessions feature)
- `src/features/sessions/application/sessionEventFactory.ts` (+ test) — pure
  `createSessionEvent(input)`: generates an immutable event with `id` via `createId("ev")` and a
  monotonic `seq`; accepts an injected `now` clock and id generator for deterministic tests;
  defensively redacts request/response through `shared/redaction`; flattens `correlation` into
  `correlationId`/`traceId`; copies `classification`; keeps `request`/`response` already-sanitized.
- `src/features/sessions/application/buildExecutionRecord.ts` (+ test) — pure
  `buildExecutionRecord(input)` with a structural `outcome` (no cross-feature import of
  `ActionOutcome`): generates `executionId` via `createId("exec")`; derives `requestId` from
  `outcome.correlation.correlationId` when present, else `createId("req")`; copies sanitized
  request/response/correlation; sets the discriminated `classification`.
- `src/features/sessions/application/SessionRecorder.ts` — extend `RecordEventInput` with
  `error?: string` (e.g. failed-action message). Port shape otherwise unchanged.

### Application (actions feature)
- `src/features/actions/application/runAction.ts` — add `classification?: FailureClassification`
  to `ActionOutcome`, derived from the `ActionResult` (`success` / `needs-auth` /
  `failure.classification`); add optional `recorder?: SessionRecorder` and `summary?: string` to
  `RunActionInput`; after computing the outcome, when a recorder is provided build an
  `ExecutionRecord` via `buildExecutionRecord` and call `recorder.record(...)` for
  success/failure outcomes only (needs-auth is not recorded — unchanged behavior).
- `src/features/actions/application/runAction.test.ts` — extend: recorder invoked for success and
  failure with correct source/summary/classification; needs-auth not recorded; execution/request
  ids unique.

### Store / infrastructure (event sink + concrete recorder)
- `src/shared/store/session.store.ts` — replace `addEvent(NewEvent)` with
  `appendEvent(ev: SessionEvent)` that gates on `recording && !paused` (unchanged drop behavior)
  and appends immutably; remove id/timestamp/redaction logic from the store (owned by the
  factory); keep `start`/`pause`/`resume`/`clear`/`setEnvId`/`finalizeForEnvironmentSwitch`/
  `exportSession`; drop the `NewEvent` interface.
- `src/shared/store/sessionRecorder.ts` (+ test) — `export const sessionRecorder: SessionRecorder`
  over `useSessionStore`: `start` delegates to store `start` + `setEnvId`; `record` builds the
  event with `createSessionEvent` and calls `appendEvent`; `stop` ends recording.
- `src/shared/hooks/useSessionRecorder.ts` — client hook returning the `sessionRecorder`
  singleton for presentation code.

### Presentation
- `src/features/actions/presentation/ActionPanel.tsx` — remove the direct `addEvent` call; pass
  `recorder: sessionRecorder` and `summary: t(action.summaryKey)` into `runAction`; on
  `AbortError` (user cancellation) record an `info` event with classification
  `{ kind: "infrastructure", subtype: "cancelled" }` via the recorder.
- `src/features/map/presentation/MapCanvas.tsx` — replace both `addEvent` calls (`map.place`,
  `map.follow`) with `sessionRecorder.record({ source: SessionSource.System, ... })`.
- `src/features/environments/presentation/EnvironmentModal.tsx` — replace the `addEvent` call
  (`admin.auth.login`) with `sessionRecorder.record({ source: SessionSource.System, ... })`.
- `src/shared/store/environmentSwitch.ts` — unchanged (still calls
  `finalizeForEnvironmentSwitch`).

### Tests
- `src/features/sessions/application/sessionEventFactory.test.ts` — immutability, unique ids,
  monotonic `seq`/chronology under concurrent records, redaction of sensitive keys, correlation
  flattening, classification carried, system-event shape, deterministic injected clock.
- `src/features/sessions/application/buildExecutionRecord.test.ts` — id generation, requestId from
  correlationId, classification derivation, sanitized request/response carried.
- `src/shared/store/sessionRecorder.test.ts` — records while recording, drops while paused
  (unchanged), events immutable, environment-scoped via `envId`, manual + workflow source
  interleaving keeps chronological order, business failure vs. infrastructure failure distinct,
  cancellation recorded, redaction holds.
- Update `src/shared/store/environmentSwitch.test.ts` — replace `addEvent` usage with the
  factory-built `SessionEvent` via `appendEvent`.
- Update `src/features/actions/application/runAction.test.ts`.

## Decisions
- **Recording location**: inside `runAction` via an optional `recorder` dependency so manual and
  future workflow executions share the exact executor → recorder path (AGENTS §19); `ActionPanel`
  supplies the recorder and the localized `summary`.
- **needs-auth**: not recorded (unchanged behavior; it remains a UI prompt concern).
- **Pause**: still discards events while paused (unchanged behavior); pause semantics may be
  revisited with the timeline work in Task 3.3.
- **Cancellation**: recorded as an `info` event with classification
  `{ kind: "infrastructure", subtype: "cancelled" }` — evidence of an aborted request.
- **Redaction**: owned by the application factory (single source of truth); the store no longer
  re-implements it; the `SanitizedRequest`/`SanitizedResponse` types keep secrets out upstream.
- **Chronology**: the factory emits a monotonic `seq`; the store appends in arrival order, so
  concurrent manual/workflow records stay ordered.
- **Component/E2E tests**: no Testing Library/E2E runner is installed; Task 3.1 adds unit and
  store-level integration coverage. Timeline display work remains in Task 3.3.

## Verification
`bun run lint`, `bun run typecheck`, `bun run test`, `bun run audit:boundaries`, `bun run build`.
Preserve user-owned changes (`bun.lock`, `docs/`).