# Task 0.3 Implementation Plan — Core ports, data ownership, and redaction policy

Status: ready to implement. Source: `docs/plans/longterm_plan.md` Task 0.3.

> Implementer: read `AGENTS.md`, `docs/plans/longterm_plan.md`, and the already-agreed `docs/plans/task-0.2-plan.md` first. This task defines **interfaces and policy only** — it must not introduce React/Next/Axios/browser/Leaflet imports into any `domain/` or `application/` module, and must not encode tokens, credentials, or framework objects in domain events.

---

## 1. Goal

Establish stable, framework-free interfaces so presentation code never owns backend, token, session, or map behavior, and define the centralized redaction rules that must run **before** any request/response/event is persisted (roadmap Task 0.3; AGENTS.md Clean Architecture §2–4, §6; FR-37–43).

### Decisions already agreed with the user

1. **Define-only + minimal enforcement.** The 8 ports return safe plain models; a redaction module with tests is added and wired at the *existing* session-recording boundary. The removal of `token`/`credentials` from `ActorRef` and token persistence from `auth.store`/`environment.store` is **deferred to Phases 1–2** and documented in the redaction policy as a known debt.
2. **Separate `ExecutionRecord` type.** The request envelope (requestId/correlationId/environmentId/timing/classification) is a standalone domain type consumed by the `SessionRecorder` port. `SessionEvent` and the `.wusool-session` serializer/export format are **unchanged** in this task; folding the envelope into events happens additively in Phase 3.

---

## 2. Current-state findings (evidence)

- `src/features/actors/domain/actor.types.ts:17-31` — `ActorRef` carries `credentials?: Credentials` (incl. `password`) and `token?: string`; `actor.store.ts` persists the workspace (thus tokens/passwords) to `localStorage`.
- `src/shared/store/auth.store.ts` and `environment.store.ts` persist `tokens` and `adminToken` to `sessionStorage`.
- Presentation calls infrastructure directly: `ActorPanel.tsx:9`, `CreateActorModal.tsx:9`, `AuthPromptModal.tsx:6`, `ActionPanel.tsx:21-22` import repository/auth modules.
- `ActionRepository` port exists (`actions/application/actionRepository.ts`) but returns a loose `{ ok: boolean; status; data | error }` with **no correlation, no classification, no envelope**.
- No redaction, correlation, or identifier utilities exist anywhere.
- Session recording is gated on `recording && !paused` in `session.store.ts:63` and is the only current persistence boundary.
- `WusoolApiClient.toApiError` does **not** yet capture `traceId`/`path` (that is Task 0.2 scope; its output feeds `CorrelationInfo` here).
- `src/infrastructure/contracts/` is **missing** — Task 0.2 is planned but not yet implemented. This task depends on it only for *value population*, not for type shapes.

---

## 3. Deliverables

### 3.1 Redaction module + policy + tests (do this FIRST)

**`src/shared/redaction/redact.ts`** (new, pure TS, no framework imports):
- `SENSITIVE_KEY` regex covering `password|passwd|token|secret|credential|authorization|api[_-]?key|set-cookie|cookie|session`.
- `redact(value: unknown): unknown` — recursive walk of objects/arrays; any value under a sensitive key replaced with `REDACTED = "••••••••"`. Leaves numbers/bools/plain strings intact; idempotent.
- `redactHeaders(headers: Record<string,string>)` — redacts header *names* matching the pattern and their values (covers `Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key`).
- `redactRequest(req)` / `redactResponse(res)` → return `SanitizedRequest` / `SanitizedResponse` (§3.3), guaranteeing no secrets can reach persisted evidence.

**`docs/security/redaction-policy.md`** (new): field categories, where redaction is enforced (recording boundary now; BFF response + export later), the rule that tokens/credentials never enter domain events/state/exports, and the recorded debt that `ActorRef`/stores still carry secrets until Phases 1–2.

**`src/shared/redaction/redact.test.ts`**: nested-body passwords/confirmPassword/tokens, `credentials` objects, authorization/cookie/api-key headers, array traversal, non-sensitive passthrough, idempotency, `redactRequest`/`redactResponse` outputs.

### 3.2 Identifier utilities

**`src/shared/lib/ids.ts`** (new): `createId(prefix: string): string` → `${prefix}_${Date.now()}_${random}`, used for `executionId`, `requestId`, `eventId`, and framework-side `correlationId`. **`ids.test.ts`**: uniqueness, format, prefix isolation.

### 3.3 Request envelope / ExecutionRecord + failure classification

**`src/features/sessions/domain/evidence.types.ts`** (new, framework-free):
- `CorrelationInfo { correlationId?: string; traceId?: string }`.
- `SanitizedRequest { method; path; query?; headers: Record<string,string>; body?: string }` and `SanitizedResponse { statusCode; headers; body? }`.
- `FailureClassification` discriminated union: `{ kind: "success" } | { kind: "business" } | { kind: "authorization"; needsAuth: boolean } | { kind: "validation" } | { kind: "infrastructure"; subtype: "timeout" | "network" | "backend-unavailable" | "cancelled" }`.
- `ExecutionRecord { requestId; executionId; environmentId; correlation?; actorId; actionId; startedAt; durationMs; request: SanitizedRequest; response?; classification }`.

**`evidence.types.test.ts`**: construction, immutable ids, defaults, and that `SanitizedRequest`/`SanitizedResponse` are only producible through `redactRequest`/`redactResponse` (secret-leak regression via a redaction round-trip test).

### 3.4 Error classification mapping

**`src/shared/errors/classification.ts`** (new) + test: `classifyError(err: unknown): FailureClassification` and `classifyHttpStatus(status, needsAuth)`. Rules: 401/403 → `authorization`; other 4xx → `business`; network/DNS → `backend-unavailable`; timeout → `timeout`; `AbortError` → `cancelled`; client-side validation errors → `validation`. No empty catch, no swallowed errors; `AppError` codes preserved.

### 3.5 The eight ports (domain/application interfaces only)

Each port lives in the owning feature's `application/` layer (AGENTS.md feature-ownership) and is exported through the feature barrel. Port input objects get co-located Zod schemas so every external input is validated at the boundary ("every external input is validated").

- **`src/features/actors/application/ActorRepository.ts`** (new): `discover(input: { envId; types; signal? })` → `DiscoverActorsResult`; `create(input)` → `CreateActorResult`. Returns **safe actor models** (id/type/label/sublabel/source/authenticated/email) with no `token`/`credentials`/`raw` — mappers must project these away (documented data-ownership rule; Phase 2 implements the mappers).
- **`src/features/actors/application/CredentialVault.ts`** (new): `store/resolve/clear/clearForEnvironment/clearAll` keyed by `(actorId, envId)`. `resolve` returns `AuthContext { accessToken; refreshToken?; expiresAt? }` — explicitly documented as server-side-only; must never cross to presentation, domain events, or exports. In-memory dev adapter comes in Phase 1.
- **`src/features/actions/application/EntityRepository.ts`** (new): `search({ envId; kind; query; signal? })` → `EntityOption[]` (`{ value; label }`, **no `raw` backend snapshot**).
- **`src/features/actions/application/actionRepository.ts`** (edit): replace the loose result with a discriminated `ActionResult` = `{ status: "success"; statusCode; data?; correlation } | { status: "needs-auth"; correlation } | { status: "failure"; classification; statusCode?; message; correlation }`. Keep the file/export name to avoid churn; update its tests.
- **`src/features/sessions/application/SessionRecorder.ts`** (new): single recording path — `start({ sessionId?; environmentId })`, `record(input: RecordEventInput)` (where `RecordEventInput` carries source, actor, action, summary, status, `ExecutionRecord`, position), `stop()`. Recorder applies redaction internally **before** anything reaches storage (contract enforced by test). Existing component-level `addEvent` calls are replaced in Phase 3, not now.
- **`src/features/sessions/application/SessionStorage.ts`** (new): `save/load/list/delete` over `StoredSession` (IndexedDB browser impl in Phase 3).
- **`src/features/sessions/application/BackendLogRepository.ts`** (new): `fetchForCorrelation({ envId; correlationId; signal? })` → `BackendLogEntry[]` (no such backend API today — marked unavailable in Task 0.2; port declared now).
- **`src/features/map/application/MapAdapter.ts`** (new): `renderMarkers(drawRoute/setViewport/subscribe)` with plain `MapMarker`, `MapViewport`, and a `MapInteraction` discriminated union (`marker-click`, `map-click`, `marker-drag-end`). Leaflet stays behind this in Phase 4.

Barrels to update: `actors/index.ts`, `actions/index.ts`, `sessions/index.ts`, `map/index.ts`.

### 3.6 Minimal enforcement wiring

**`src/shared/store/session.store.ts`** — in `addEvent`, run `redactRequest`/`redactResponse` (and redact `error`) on incoming request/response before constructing the `SessionEvent`. This is the one enforcement point that exists today and makes "no secrets persisted" true now, not later.

### 3.7 Architectural boundary audit

- **`src/architecture/boundaries.test.ts`** (new, Vitest): scans every `src/features/*/domain` and `*/application` file (and `src/shared/redaction`, `src/shared/errors`) and fails on any import specifier matching `react|next|axios|leaflet|zustand` or `@/shared/store`. This is the cross-platform, CI-safe form of the `rg` audit in the acceptance criteria.
- **`package.json`**: add `"audit:boundaries"` script running the equivalent `rg` check for the documented quick manual audit.

---

## 4. Tests (Vitest, `src/**/*.test.ts`)

1. Redaction: §3.1 list.
2. Identifiers: uniqueness/format.
3. Evidence construction: `ExecutionRecord` shape, immutable ids, classification defaults, redaction round-trip (secrets cannot appear in `SanitizedRequest`/`SanitizedResponse`).
4. Error mapping: each classification path incl. AbortError, timeout, 401/403 vs other 4xx, network.
5. `actionRepository.test.ts`: updated to the new `ActionResult` discriminated union.
6. Boundary audit test (§3.7).

"DTO mappers" tests belong to Task 0.2; do not duplicate them here.

---

## 5. Verification commands

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run audit:boundaries
```

Caveat: per the roadmap, the toolchain (Task 0.1) may still be blocked by missing platform optional deps in this environment; do not claim the task done while those mask the checks — fix or explicitly track the blocker first.

---

## 6. Acceptance criteria mapping

| Criteria | Where met |
|---|---|
| No application/domain interface imports React, Next, Axios, browser APIs, or Leaflet | §3.7 boundary test; `rg audit:boundaries` |
| Every external input is validated | Zod schemas co-located with each port input (§3.5) |
| Redaction has explicit tests | §3.1, §4.1 |
| Request envelope with request ID, correlation ID, environment ID, timing, sanitized request/response, failure classification | §3.3 `ExecutionRecord` |
| No tokens/credentials/framework objects in domain events | §3.3 redaction round-trip test; §3.6 enforcement; policy doc §3.1 |

---

## 7. Potential pitfalls

- Do **not** encode tokens, raw credentials, or `L.Map`/`L.Marker`-style objects in domain events or interface return models.
- Do **not** remove `token`/`credentials` from `ActorRef` or strip store persistence here — that is Phase 1–2; only *document* the debt in the policy.
- Do **not** change the `.wusool-session` export format or `SessionEvent` shape.
- Do **not** duplicate Task 0.2 work (DTO schemas, mappers, `traceId` capture in `ApiError`); `CorrelationInfo` is declared now but populated once Task 0.2 lands.
- Redaction must be applied at the persistence boundary, not rely on callers remembering to sanitize.

---

## 8. Out of scope (later phases)

- BFF route handlers, server Wusool client, credential-vault dev/prod adapters → Phase 1.
- Removing direct presentation→infrastructure calls; store migrations; stripping secrets from `ActorRef`/stores → Phases 1–3.
- Centralized `SessionRecorder` adoption replacing `session.store.addEvent`; IndexedDB `SessionStorage` impl; log retrieval → Phase 3.
- Leaflet `MapAdapter` impl; movement engine → Phase 4.

---

## 9. Recommended implementation order

1. `ids.ts` + tests.
2. `redact.ts` + tests + `docs/security/redaction-policy.md` (policy first, per roadmap line 753).
3. `evidence.types.ts` + tests (execution record, classification).
4. `classification.ts` error mapping + tests.
5. The 8 port interfaces + Zod input schemas + barrels.
6. Update `actionRepository.ts` to `ActionResult` (+ tests).
7. Wire redaction into `session.store.addEvent`.
8. Boundary test + `audit:boundaries` script.
9. Run §5 verification; mark acceptance criteria.