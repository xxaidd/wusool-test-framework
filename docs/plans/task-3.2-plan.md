# Task 3.2 — Add continuous local session storage and lifecycle

## Goal
Persist the active session continuously through a storage abstraction appropriate for large
histories (IndexedDB), so an active session survives page reload within documented limits without
relying on localStorage, while storage failures are visible and non-silent.

## Why
FR-41 and AGENTS.md §22 session-storage rule. Current state after Task 3.1:

- `SessionRecorder` is centralized: events are immutable, sanitized, and carry `seq`,
  `requestId`, `executionId`, `correlationId`, `traceId`, and `classification`.
- The `SessionStorage` port exists (`src/features/sessions/application/SessionStorage.ts`) but has
  **no implementation** and no callers.
- `useSessionStore` (`src/shared/store/session.store.ts`) is in-memory only: events are lost on
  reload, there is no `sessionId`/`name`, no persistence, and no storage-error surface.
- Environment switching resets in-memory events via `finalizeForEnvironmentSwitch`; the old
  session has no durable record.
- Vitest runs in a `node` environment with no IndexedDB implementation.

## Architecture
```
SessionPanel / sessionRecorder / environmentSwitch
        ↓
useSessionStore (active session: sessionId, name, envId, events — in memory)
        ↓ on every mutation
sessionPersistence (store-backed: scheduleSave debounced 400 ms / flush on lifecycle)
        ↓
SessionStorage (port)  →  IndexedDbSessionStorage (infrastructure)
        ├─ wusool-sessions DB, "sessions" store keyed by sessionId
        └─ active-session pointer in sessionStorage (wusool-active-session)
useSessionPersistence hook → silent auto-restore on reload (same tab)
```

- The application-level helpers (`toStoredSession`/`loadSession`) are pure and framework-free.
- The store-backed module owns debouncing, dirty tracking, and the failure path.
- The hook performs hydration and best-effort flush on page unload.

## Changes

### Domain / application (sessions feature)
- `src/features/sessions/domain/session.types.ts` — add optional `sessionId?`, `name?` to
  `SessionState`.
- `src/features/sessions/application/SessionStorage.ts` — extend `StoredSession` with optional
  `name?` and `updatedAt?`; document that only sanitized evidence is persisted.
- `src/features/sessions/application/storedSession.schema.ts` (+ test) — Zod load-boundary schema
  for `StoredSession`: requires `sessionId`, `environmentId`, `formatVersion` equal to
  `SESSION_FORMAT_VERSION` (future versions rejected with an actionable `SessionStorageError`),
  `events` validated structurally, optional `startedAt`/`name`/`updatedAt`. Imported session
  files reuse this in Task 3.4.
- `src/features/sessions/application/sessionPersistence.ts` (+ test) — pure helpers:
  - `toStoredSession(snapshot)` builds a `StoredSession` from a plain store snapshot
    (events, startedAt, sessionId, envId, name, formatVersion, updatedAt).
  - `loadSession(raw, storage)` validates raw data through the schema and returns a typed
    `StoredSession`, throwing `SessionStorageError` for malformed/unsupported payloads.

### Infrastructure
- `src/features/sessions/infrastructure/indexedDbSessionStorage.ts` — concrete `SessionStorage`
  over IndexedDB:
  - DB `wusool-sessions` v1, object store `sessions` keyed by `sessionId`.
  - `save` = put, `load` = get, `list` = cursor/`getAll` with per-record event count, `delete` =
    delete.
  - Availability guard: when `indexedDB` is undefined (private mode/SSR/non-supporting browser),
    throws `SessionStorageError` with an actionable message; callers surface it, never silently
    drop.
  - Active-session pointer helpers over `sessionStorage` key `wusool-active-session`
    (`{ sessionId, envId, name, startedAt }`): `getActiveSessionRef`, `setActiveSessionRef`,
    `clearActiveSessionRef`. This is a non-sensitive pointer only — never session events.

### Store / persistence wiring
- `src/shared/store/session.store.ts`:
  - `start(name?)` — generate `sessionId = createId("ses")`, set `name`, `recording: true`,
    `startedAt` (kept on resume), and schedule a save.
  - `appendEvent` — after appending, schedule a batched save.
  - New `end()` — stop recording, flush the final record (kept in IndexedDB as evidence), clear
    the active pointer, keep `events` in memory for display until the panel is cleared.
  - `clear()` — cancel pending save, delete the stored record + active pointer, reset in-memory
    state.
  - `finalizeForEnvironmentSwitch` — flush the current session and clear the active pointer before
    resetting (old session retained as stored evidence; the new environment starts with recording
    off, unchanged).
  - New `storageError?: string` state + `setStorageError`.
  - `exportSession` — flush pending writes before serializing so exports are complete.
- `src/shared/store/sessionPersistence.ts` (+ test) — store-backed module:
  - `scheduleSave()` — trailing 400 ms debounce with a dirty flag that coalesces bursts.
  - `flush()` — build `StoredSession` via `toStoredSession`, write via the IndexedDB adapter, set
    the active pointer; on success clear `storageError`.
  - Failure handling — on save failure set `storageError` and record one `info` system event with
    classification `{ kind: "infrastructure", subtype: "storage" }`; a guard prevents the failure
    event from scheduling further failing saves (no loop) while events keep accumulating in memory
    so export/evidence are never silently dropped.
- `src/shared/hooks/useSessionPersistence.ts` — client hook invoked once in `App` after mount:
  reads the active pointer, loads + validates through `loadSession`, restores into the store
  (recording resumes, `envId`/`startedAt`/`sessionId`/`name` preserved), surfaces `storageError`
  on load failure; registers a `pagehide` best-effort flush.

### Presentation
- `src/features/sessions/presentation/SessionPanel.tsx` — storage-error banner (visible,
  non-silent), "End session" button (calls `end()`, disabled when not recording), optional
  session-name input shown when starting.
- i18n: add keys `session.storageError`, `session.end`, `session.name`,
  `session.namePlaceholder` to `src/shared/i18n/en.ts` and `ar.ts`.

### Tests
- `src/features/sessions/infrastructure/indexedDbSessionStorage.test.ts` — integration over
  `fake-indexeddb` (new devDependency): save/load/list/delete, large-session batch write, missing
  key, and IndexedDB-unavailable → `SessionStorageError`.
- `src/features/sessions/application/storedSession.schema.test.ts` — valid payload, malformed
  payload, unsupported future `formatVersion` rejected with an actionable error.
- `src/features/sessions/application/sessionPersistence.test.ts` — `toStoredSession` shape,
  `loadSession` valid/invalid/future-version.
- `src/shared/store/sessionPersistence.test.ts` — debounce coalescing, dirty flush on
  start/end/clear/switch, save failure → `storageError` surfaced + single non-looping event, events
  retained in memory, export still produces a payload.
- Lifecycle coverage in the session store tests — `sessionId`/`name` on start, `end` vs `clear`
  semantics, storage-error state.
- Reload-recovery test — pointer → load → validate → restore; missing pointer → no-op.
- Redaction regression — serialized persisted `StoredSession` contains no secrets.
- Update `src/shared/store/environmentSwitch.test.ts` — env switch retains the old persisted
  session and clears the active pointer.
- Update `src/shared/store/sessionRecorder.test.ts`/`environmentSwitch.test.ts` store resets for
  the new `sessionId`/`name`/`storageError` fields where needed.

## Decisions
- **IndexedDB** behind the `SessionStorage` port (AGENTS §22); `sessionStorage` only for the
  non-sensitive active-session pointer, never for session events.
- **Batch writes**: trailing 400 ms debounce coalesces high-frequency events; explicit flush on
  end/clear/environment-switch/export.
- **Auto-resume silently** on page reload in the same tab (user decision). A closed tab leaves the
  session stored as inactive evidence; the active pointer is `sessionStorage`-scoped, so a new tab
  does not auto-resume.
- **Storage failure**: visible banner + one recorded system event; events stay in memory so
  evidence/export are never silently dropped.
- **Dependency**: add `fake-indexeddb` as a devDependency for reliable adapter tests (user
  decision); this modifies the user-owned `bun.lock`, which must be reconciled, not overwritten.
- **UI scope**: minimal in Task 3.2 (banner, end button, optional name). Timeline/inspector and
  the full session-manager list remain Tasks 3.3–3.4.

## Verification
`bun run lint`, `bun run typecheck`, `bun run test`, `bun run audit:boundaries`, `bun run build`.
Preserve user-owned changes (`bun.lock`, `docs/`).