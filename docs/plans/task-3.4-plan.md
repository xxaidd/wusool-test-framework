# Task 3.4 — Versioned export and read-only session import

## Goal
Export a complete, sanitized `.wusool-session` record and open it later in a read-only viewer that
renders timeline + technical details + cached log excerpts without executing any backend action.
Imports are validated against a versioned schema before use and can never issue a backend request,
mutate an active session, or mutate an active workflow (FR-42–44, AGENTS §22).

## Current state (what exists)
- `sessionSerializer.ts` exports `{ app, formatVersion:1, exportedAt, startedAt?, eventCount, events }`
  — no environment metadata, no paths, no logs.
- `sessionDownloader` produces `wusool-session-<ts>.json` (`application/json`); export goes through
  `exportSession.ts` → `browserSessionDownloader`.
- `storedSession.schema.ts` (load-boundary) already rejects unsupported `formatVersion` with
  `SessionStorageError`; events are `passthrough`-validated.
- `buildStaticPaths(events)` already derives static movement paths from `position` events.
- `CorrelatedLogs` fetches logs lazily on demand (no prefetch, aborted on unmount); there is **no
  log cache** anywhere, so imports can't show offline logs today.
- `SessionPanel` has export + clear controls only; `EventInspector` + `SessionTimeline` are reusable.
- No `SessionImportError`; `session.store` has no `logs` state; no i18n keys for import/open.

## Architecture
```
export: SessionPanel → session.store.exportSession
            → exportSession (env metadata, paths, logs) → serializeSession → sessionDownloader (.wusool-session)
import: SessionPanel → file input → importSessionFile (size check → parse → migrate → validate)
            → read-only SessionViewer modal (SessionTimeline + EventInspector with static/cached logs)
            → no backend request, no store mutation (except transient viewer-local state)
```

## Changes

### Domain / application (pure, framework-free)
- **`storedSession.schema.ts`** — extract the `sessionEventSchema` block into its own exported
  `sessionEventSchema` (same field set) so the import schema reuses it; keep `storedSessionSchema`
  composed from it.
- **New `sessionLog.schema.ts`** — `sessionLogSchema`: `ts`, `level`, `message` + optional
  `metadata` passthrough (mirrors `BackendLogEntry`).
- **New `exportedSession.schema.ts`** — load-boundary for imported `.wusool-session` files:
  - `formatVersion: z.literal(1)` (unsupported future versions rejected by a dedicated migration
    path with an actionable error, not a generic parse failure);
  - required: `app`, `exportedAt`, `eventCount`, `events`;
  - optional: `sessionId`, `name`, `startedAt`, `environment: { id, label }`, `paths: StaticPath[]`,
    `logs: { eventId, entries: BackendLogEntry[] }[]`;
  - `superRefine` asserting `eventCount === events.length`; `passthrough()` for forward-compatible
    unknown keys.
  - `ExportedSessionData` type inferred from the schema; the serializer's output type becomes
    `Omit<ExportedSessionData, ...>`-aligned (export and load share one boundary).
- **New `sessionMigrations.ts`** — `SESSION_MIGRATIONS` registry mapping `formatVersion` →
  migrate function (empty for v1); `migrateSessionFile(version, raw)` returns the latest version or
  throws `SessionImportError` listing the *supported* versions for future files (actionable message).
- **New `sessionImporter.ts`** — `MAX_IMPORT_BYTES = 50MB`; `checkImportSize(bytes)`; `importSessionFile(rawText)`
  = parse JSON → `migrateSessionFile` → `exportedSessionSchema.safeParse`; returns `ImportedSession`
  (`{ sessionId?, name?, startedAt?, environment?, events, paths, logs }`) or throws
  `SessionImportError` with a stable message (malformed JSON, unsupported version, oversized,
  missing/invalid fields, eventCount mismatch). No secrets: the shared redaction module is applied
  defensively only if a future field ever leaks; v1 events are already sanitized at record time.
- **`sessionSerializer.ts`** — extend `ExportedSession` with `sessionId?`, `name?`,
  `environment?: { id, label }`, `paths`, `logs`; `serializeSession` accepts `environment` and
  `logs` and always includes `paths` (via `buildStaticPaths`) and `logs`.
- **`exportSession.ts`** — accept `environment` + `logs` from the store and pass through.
- **`SessionDownloader` / `sessionDownloader` (application)** — no interface change; filename
  handled in infrastructure.
- **New `SessionImportError`** in `src/shared/errors/AppError.ts` (code `SESSION_IMPORT`) — separate
  from `SessionStorageError` so the UI can render a targeted translated error.
- **`features/sessions/index.ts`** — export the new schema/import/migration/log modules and the
  error.

### Browser state / store
- **`session.store.ts`** — add `logs` state (`Record<string, BackendLogEntry[]>` keyed by event id)
  + `setLogs(eventId, entries)`; `exportSession` passes `environment` (from `environment.store`:
  `{ id, label }`) and `logs` through `exportSession`. `logs` is **not** persisted to IndexedDB in
  this task (offline import uses the export's embedded logs; live session log cache remains
  in-memory for the current tab) — logged as a documented decision.

### Infrastructure
- **`sessionDownloader.ts`** — `sessionFileName` outputs `.wusool-session` (MIME stays
  `application/json`); `.json` removed from the canonical export filename.

### Presentation
- **`CorrelatedLogs.tsx`** — add props `readOnly?: boolean` and `staticEntries?: BackendLogEntry[]`;
  on a successful fetch, call `setLogs(event.id, entries)` to cache for export; when
  `readOnly`/`staticEntries` are provided, render those entries directly with **no** load button,
  no repository call, no env dependency (offline path never constructs a log repo).
- **`EventInspector.tsx`** — pass `readOnly`/`logs` props through to `CorrelatedLogs`.
- **New `SessionViewer.tsx`** — read-only modal (`Modal`): title from session name/id, session
  metadata rows (name, id, environment, exportedAt, eventCount), embedded `SessionTimeline`
  (reuse, `onSelect` opens the inspector with the event's cached logs), `EventInspector` in read-only
  mode, and no session/world controls (no start/pause/clear/export/delete).
- **`SessionPanel.tsx`** — add an "Open" button + hidden `<input type="file" accept=".wusool-session,application/json">`;
  on change: read file → `importSessionFile`; success → open `SessionViewer` with the imported
  session; failure → show translated `SessionImportError` notice inline. Import never touches the
  active session store.

### i18n (`en.ts`/`ar.ts`)
- `session.open`, `session.importing`, `session.importError`,
  `session.importInvalid` (malformed/missing fields), `session.importUnsupportedVersion`,
  `session.importTooLarge`, `session.readOnly` (viewer badge), `session.viewerTitle`,
  `session.logsOffline` (read-only log excerpt label), `session.environment` (viewer metadata row).

## Tests
- **Schema/migrations** — `exportedSession.schema.test.ts`: valid v1 accepted; eventCount mismatch
  rejected; unknown extra keys tolerated; missing required fields rejected. `sessionMigrations`
  registry: v1 passthrough; unsupported version → `SessionImportError` with supported-version list.
- **Importer** — `sessionImporter.test.ts`: round-trip `serializeSession` → `importSessionFile`
  (events, paths, logs, environment preserved); malformed JSON; oversized (>50MB);
  unsupported future version; missing required fields; redaction regression (fixture payload with
  token/password/authorization headers never present in import output).
- **Viewer** — `SessionViewer.test.tsx`: renders timeline + events + metadata; renders embedded
  static log excerpts; **no `fetch`/axios calls issued**; **no session-store mutations** (spy on
  `useSessionStore` actions).
- **Panel** — `SessionPanel.test.tsx`: Open button present; file change with valid JSON opens the
  viewer; invalid/oversized/unsupported file shows the translated error and does not open the viewer.
- **Store** — `session.store` `setLogs`/`logs` and export passing `environment`/`logs`.
- **Downloader** — `sessionFileName` produces `.wusool-session`.

## Decisions
- **Cache fetched logs & embed them in the export** (user-confirmed): log excerpts travel with the
  evidence, so reopened sessions show correlated logs offline. Logs are already redacted before
  display via `safeMessage`/`safeMetadata`; the embedded copies use the same redacted entries.
- **Offline viewer has no map** (user-confirmed): read-only viewing is timeline + technical detail +
  static paths listed as metadata; `paths` are included in the file for future map rendering but not
  rendered in this task.
- **`.wusool-session` is the canonical format**; exports become a superset of the previous JSON and
  remain aligned with the shared load boundary (`exportedSessionSchema`). `.json` filename replaced.
- **Future versions are rejected with actionable errors** via the `SESSION_MIGRATIONS` registry —
  a deliberate extension point; no migration logic is written for non-existent versions.
- **Import is fully offline & non-mutating**: no repository construction, no BFF request, no store
  writes; the viewer owns only transient local presentation state.
- **Live-session log cache stays in-memory** this task (not persisted to IndexedDB) to keep the
  change scoped; embedded export logs satisfy offline evidence.

## Verification
`bun run lint`, `bun run typecheck`, `bun run test`, `bun run audit:boundaries`, `bun run build`.
Preserve user-owned changes (`bun.lock`, `docs/`).