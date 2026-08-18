# Task 1.3 — Make environment switching atomic and observable

## Goal
Manage preset/custom backend environments safely and isolate all environment-specific state so
that switching is atomic (validated before commit), confirmed, cancels active work, clears scoped
state, and is observable through recorded session events — while never persisting the admin token
or allowing private-network SSRF through custom URLs.

## Why
FR-33–37 and current defects:

- `environment.store` persists `adminToken` (a JWT) in browser `sessionStorage` via `partialize`,
  contrary to the Task 1.3 pitfall "avoid exposing the admin token in the UI or persisting it in
  browser storage".
- Cross-environment leakage: `actor.store` (workspace/placed/selectedActorId), `auth.store`, and
  `session.store` events are global and only partially cleared from the modal; MapCanvas
  route/drawing/following local state is never cleared on switch.
- Custom URL SSRF hardening was explicitly deferred to Task 1.3 (`environmentResolver` still
  accepts `http://10.0.0.5:8080`).
- Backend-unavailable during an action throws an unhandled rejection in `ActionPanel.execute` (no
  session event, `executing` stuck) — violates FR-37.
- Confirmation (FR-35) only triggers when the workspace has actors; session/map state is ignored.
- No `environment.switched` / backend-unavailable session events exist.

## Current state (after Tasks 1.1–1.2)
- All Wusool traffic is BFF-mediated; `POST /api/wusool/auth/logout` already clears vault contexts
  per environment; `POST /api/wusool/health` probes an environment server-side.
- `environmentResolver` validates scheme/userinfo but not host/IP; presets (incl.
  `http://localhost:5002`) are resolved by id.
- `EnvironmentModal.apply()` runs `logout(oldEnv)` → `setEnv` → `setAdminToken` → `clearWorkspace`
  → `clearAuth`; confirmation only when `workspaceCount > 0`.
- `MapCanvas` holds route/drawing/following/speed in local state; a `RouteFollower` interval runs in
  an effect.
- `bffActionRepository.execute` rethrows network failures as `BffError` (502), which escapes
  `runAction` and crashes `ActionPanel.execute`.
- Workflows (Phase 5) and an entity cache don't exist yet; session storage is in-memory only
  (Phase 3).

## Architecture
```
EnvironmentModal (confirmation → apply)
    ↓
switchEnvironment(target, adminToken)   src/shared/store/environmentSwitch.ts
    ├─ validate target via BFF /health (SSRF/scheme errors abort; do not switch)
    ├─ logout(oldEnv)            (server-side vault clear)
    ├─ clear auth + actor workspace + session (env-scoped)
    ├─ record environment.switched (system event)
    └─ set env → env store triggers checkHealth

BFF /health → resolveEnvironment → ssrfGuard (custom URLs) → serverProbe
```

Note: the orchestrator lives in `src/shared/store/` (not `src/shared/lib/`) because the
architectural-boundary audit treats `shared/lib` as core and forbids it from importing stores and
infrastructure; store-adjacent orchestration is audit-clean.

## Changes

### Server side
- `src/infrastructure/configuration/ssrfPolicy.ts` — `getSsrfPolicy(): { allowPrivateNetwork:
  boolean }` from `process.env.WUSOOL_ALLOW_PRIVATE_NETWORK === "1"` (deployment policy; presets
  unaffected).
- `src/infrastructure/server/ssrfGuard.ts` (+ test) — `assertSafeCustomUrl(rawUrl, { allowPrivateNetwork,
  resolve })`:
  - require http/https, no userinfo (kept from the resolver);
  - reject loopback (`localhost`, `.localhost`, `127.0.0.0/8`, `::1`), private (RFC1918, ULA
    `fc00::/7`), link-local (`169.254/16`, `fe80::/10`), metadata (`169.254.169.254`), IPv4-mapped
    IPv6, unspecified/broadcast;
  - for DNS hostnames resolve via injected `resolve` (default `node:dns` `lookup`, `{all:true}`)
    and reject if any address is blocked (DNS-rebinding defense);
  - `allowPrivateNetwork` opt-in bypass;
  - throws `EnvironmentError` with an actionable message.
- `src/infrastructure/server/environmentResolver.ts` — apply `assertSafeCustomUrl` to custom
  `baseUrl` (presets stay trusted by id); accept optional `policy`/`resolve` for tests.
- `src/app/api/wusool/health/route.test.ts` (+ new test) — server client mocked: valid env probes;
  private/invalid custom URL → 400 `ENVIRONMENT` before any probe.

### Browser side
- `src/shared/store/environment.store.ts` — drop `adminToken` from `partialize` (persist `env`
  only); keep `adminToken` in-memory.
- `src/shared/store/environmentSwitch.ts` (+ test) — `switchEnvironment(target, adminToken):
  Promise<{ ok: boolean; error?: string }>`:
  - unchanged env → set adminToken only;
  - pre-validate target through BFF `/health`; `BffError.code` `ENVIRONMENT`/`VALIDATION` → return a
    validation error without changing state (atomic);
  - else: best-effort `logout(oldEnv)`, `clearAuth()`, `clearWorkspace()` (now also resetting
    `search`/`typeFilter`/`drawingRoute`), `finalizeForEnvironmentSwitch(oldLabel, newLabel)` on the
    session store, then `setEnv` + admin token (which triggers `checkHealth`);
  - returns ok even when the backend is unreachable (probe failure ≠ invalid env).
- `src/shared/store/actor.store.ts` — `clearWorkspace()` also resets `search`, `typeFilter`,
  `drawingRoute`.
- `src/shared/store/session.store.ts` — add `envId?: string` + `setEnvId`; add
  `finalizeForEnvironmentSwitch(oldLabel, newLabel)` that records an `environment.switched` info
  system event (only when recording) then clears events/`startedAt`; `clear()` also clears `envId`.
- `src/features/actions/infrastructure/actionRepository.ts` — `bffActionRepository.execute` catches
  `BffError`/network errors (rethrows `AbortError`) and returns a `failure` `ActionResult`
  classified via `classifyError`/`classifyHttpStatus` so backend-unavailable is a normal failed
  outcome (FR-37).
- `src/features/environments/presentation/EnvironmentModal.tsx` — inline custom-URL scheme check;
  call `switchEnvironment`; show validation error (no switch) vs. connection state; confirm whenever
  env changed AND (workspace actors/placed OR session events OR session recording); admin token
  input remains (in-memory only).
- `src/features/map/presentation/MapCanvas.tsx` — reset `route`/`drawing`/`following`/`speed`/
  `followActorId` on `env.id` change (effect cleanup already stops the `RouteFollower`).
- `src/features/actions/presentation/ActionPanel.tsx` — wrap `execute` in try/catch (record a
  failed session event on unexpected errors, always clear `executing`); disable Execute while
  `health.ok === false` with a connection-error hint (FR-37) — health retry still available, no
  silent retry of actions.
- `src/shared/i18n/en.ts` / `ar.ts` — new strings for environment validation errors, backend
  unavailability, and the environment-switched session event.

### Tests
- `src/infrastructure/server/ssrfGuard.test.ts` — private/loopback/link-local/metadata/IPv4-mapped
  rejections; public host accepted; hostname→private via injected resolver rejected;
  `allowPrivateNetwork` bypass.
- `src/infrastructure/server/environmentResolver.test.ts` — update: private custom URL now rejected
  (`http://10.0.0.5:8080` expectation flips); scheme/userinfo/malformed/preset cases preserved.
- `src/shared/store/environmentSwitch.test.ts` — atomic switch clears actor/auth/session and records
  env-switch event; unchanged env is a no-op; invalid target leaves state untouched; backend-down
  still switches; vault logout invoked.
- `src/shared/store/environment.store.test.ts` — persisted `wusool-environment` payload excludes
  `adminToken`; `setEnv` resets health and probes.
- `src/features/actions/infrastructure/actionRepository.test.ts` — extend: `BffError(502)` →
  failure outcome classified backend-unavailable; `AbortError` rethrown.
- `src/app/api/wusool/health/route.test.ts` — valid vs. invalid/private custom URL.
- `src/shared/store/auth-security.test.ts` — extend: no `adminToken` in persisted environment
  payload.

## Decisions
- **Admin token** stays in browser in-memory store only (not persisted, must be re-entered after a
  reload); a server-managed framework-user session is a later gate (Task 1.2 decision).
- **SSRF policy**: presets are server-trusted configuration; *custom* URLs default-deny
  private/loopback/link-local/metadata networks with `WUSOOL_ALLOW_PRIVATE_NETWORK=1` opt-in for
  genuine local development; hostnames are resolved server-side per request.
- **Session on switch**: because durable storage is Phase 3, an environment switch *finalizes* the
  in-memory session — records an `environment.switched` system event (when recording) then resets
  the event list. Events are never reused across environments (FR-36).
- **Backend-unavailable** becomes a normal failed outcome recorded in the session; actions are
  disabled while health is down; only the health probe may be retried.
- **Entity cache/workflows don't exist yet** → nothing to clear (Phase 5); route state stays in
  `MapCanvas` for now (extracted in Task 4.1) and is reset on switch.
- **Component/E2E tests**: no Testing Library or E2E runner is installed; Task 1.3 adds
  unit/integration coverage. The env-switch E2E scenario is deferred to the E2E setup in
  Tasks 0.1/2.4.

## Verification
`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run audit:boundaries`.
Preserve the user-owned `docs/plans/longterm_plan.md` modification (untouched).