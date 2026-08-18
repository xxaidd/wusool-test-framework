# Task 1.1 — Implement the Next.js BFF and Wusool server client

## Goal
Move all Wusool communication behind validated Next.js route handlers and a centralized server-only
Wusool client. No client-side direct calls to Wusool remain; all traffic is same-origin, server-mediated,
correlated, validated, and redacted.

## Architecture
```
Presentation (ActionPanel, ActorPanel, AuthPromptModal, CreateActorModal, EnvironmentModal)
    ↓
Browser application use cases (runAction, discoverActors, createActor, login, loadEntity)
    ↓
Browser BFF client  src/infrastructure/bff/client.ts  (same-origin fetch → /api/wusool/*)
    ↓
Next route handlers  src/app/api/wusool/**/route.ts  (Zod validate → resolve env → redact → typed envelope)
    ↓
Server Wusool client  src/infrastructure/server/wusoolServerClient.ts  (axios, correlation, timeout, abort)
    ↓
Wusool backend
```

## New modules

### Server side `src/infrastructure/server/` (never imported by client code)
- `wusoolServerClient.ts` — `serverRequest(env, {method, path, query, body, token, signal, correlationId})`
  → `{status, data, headers}`; sends `X-Correlation-Id` upstream; captures backend trace id from response
  headers/body; 30s timeout; axios error normalization into typed errors; aborts upstream when
  `request.signal` fires.
- `environmentResolver.ts` — maps `envId` → preset base URL (`src/infrastructure/configuration/environments.ts`);
  for custom URLs validates http/https scheme and rejects userinfo; SSRF allowlist deferred to Task 1.3.
- `credentialVaultDev.ts` — in-memory `CredentialVault` (dev adapter) keyed `(actorId, envId)` with
  store/resolve/clear/clearForEnvironment/clearAll. Singleton accessor so tests can reset.
- `serverRepository.ts` — server-side `ActionRepository`/`EntityRepository` adapters implementing the
  existing application ports, backed by the Wusool client.

### BFF routes `src/app/api/wusool/…` (plain Web `Request`/`Response` for Vitest testability)
- `POST /health` — probe backend reachability → `{ok, status, checkedAt}`.
- `POST /actors/search` — discovery: `{envId, baseUrl?, types[], adminToken?}` → `{actors: SafeActor[]}`
  (admin token used server-side, never returned).
- `POST /actors` — create: register passenger (token → vault) / admin driver / admin bus → `{actor: SafeActor}`.
- `POST /auth/login` — authenticate actor, store token in dev vault, return only `{authenticated, actorId, email}`.
- `POST /entities/search` — supporting-entity search; resolves actor token server-side for
  actor-authenticated kinds (booking/shift).
- `POST /actions/execute` — `{envId, baseUrl?, actor: SafeActorRef, actionId, args, position?}`; resolves
  token from vault, executes via shared `runAction`/server repository, returns redacted outcome +
  correlation + sanitized request/response.

Each route: Zod-validate → resolve env → call server client → normalize errors via existing
`classifyHttpStatus`/`classifyError`/`AppError` into a typed envelope → redact → respond.
Response envelope shape:
`{ok, data?, error?: {code, message, status, classification}, correlation, request?, response?, statusCode?, needsAuth?, durationMs?}`.

### Browser side
- `src/infrastructure/bff/client.ts` — same-origin `fetch` wrapper with AbortSignal, typed envelope
  parsing, BFF error normalization.

## Migrations (remove direct Wusool access)
- Rewrite to call the BFF:
  - `src/features/actors/infrastructure/actorRepository.ts` (discoverActors/createActor)
  - `src/features/actors/infrastructure/authService.ts` (login; drop unused `guest`)
  - `src/features/actions/infrastructure/entityRepository.ts` (loadEntity)
  - `src/features/actions/infrastructure/actionRepository.ts` (`httpActionRepository` → BFF-backed)
- Delete `src/infrastructure/http/WusoolApiClient.ts` (role replaced).
- `src/shared/store/environment.store.ts` `checkHealth` → BFF health route.
- `src/shared/store/auth.store.ts` stops storing tokens (tracks `authenticated` boolean + email only);
  JIT auth prompt flow preserved.
- `src/features/actions/presentation/ActionPanel.tsx` — runAction keeps browser-side; token no longer
  passed; `needs-auth` decided server-side from the vault.
- `AuthPromptModal`/`ActorPanel`/`CreateActorModal`/`EnvironmentModal` — updated signatures, admin token
  BFF-proxied, never returned.
- `runAction` (`src/features/actions/application/runAction.ts`) — remove client-side token short-circuit;
  rely on repo/BFF needs-auth.

## Tests
- Server client: timeout, abort, 4xx/5xx/network failures, correlation header propagation, trace capture,
  malformed DTO.
- Route handlers (server client mocked): input validation, redaction (no token/password in responses),
  needs-auth, backend-unavailable, correlation present.
- Dev vault: store/resolve/clear/clearForEnvironment/clearAll.
- Boundary audit: extend `scripts/audit-boundaries.mjs` and `src/architecture/boundaries.test.ts` to
  forbid `presentation`/`store` importing `@/infrastructure/server` or `@/app/api`.
- Update `actorRepository.test.ts` / `actionRepository.test.ts` to mock the BFF client.

## Verification
`bun run lint`, `bun run typecheck`, `bun run test`, `bun run build`, `bun run audit:boundaries`, plus grep
confirming no presentation file reaches Wusool URLs or imports `WusoolApiClient`.

## Out of scope (deferred)
- Durable credential vault / HTTP-only cookie session → Task 1.2.
- SSRF allowlist + atomic environment switch / server-side admin token → Task 1.3.
- Backend-log route (contract unavailable; `BackendLogRepository` port stays unimplemented).