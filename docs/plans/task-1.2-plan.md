# Task 1.2 — Implement secure actor authentication and credential vault

## Goal
Provide just-in-time (JIT) actor authentication that reliably supplies the right actor identity
without any browser token/credential persistence. Tokens live only in the server-side
`CredentialVault`; the UI sees only authentication status and safe actor metadata.

## Why
FR-05, FR-06, FR-21, FR-22 and the current token-handling defects: `ActorRef` still carries
`credentials`/`token`, `AuthPromptModal` builds a password-carrying object through its callback,
vault contexts are never cleared on environment switch or sign-out, and no expiry handling exists.

## Current state (after Task 1.1)
- `POST /api/wusool/auth/login` authenticates and stores tokens in the dev vault keyed
  `(actorId, envId)`; the browser never receives a token.
- `actions/execute` resolves tokens from the vault and returns `needs-auth` (without a backend
  call) when the vault has no context.
- The vault stores `refreshToken` and `expiresAt`, but nothing sets or checks `expiresAt`.

## Architecture
```
AuthPromptModal / ActorPanel (sign-out) / EnvironmentModal (env switch)
    ↓
authService (login | logout)            ActionPanel → runAction
    ↓                                        ↓
BFF client  src/infrastructure/bff/client.ts (same-origin)
    ↓
/auth/login, /auth/logout, /actions/execute route handlers
    ↓
CredentialVault (DevCredentialVault, keyed actorId:envId)
    ↓
Wusool server client
```

## Changes

### Domain types
- `src/features/actors/domain/actor.types.ts` — remove `credentials?` and `token?` from
  `ActorRef`. Credentials remain only in `Credentials`/`CreateActorInput` (transient, never
  persisted).
- `src/features/actors/domain/auth.types.ts` — remove unused `ActorAuthState` (an `actorId → token`
  map type) and `UserProfile`; add `expiresAt?: number` to `AuthTokens`.

### Server-side
- `src/infrastructure/server/jwtExpiry.ts` (+ test) — `extractExpiry(accessToken): number | undefined`;
  best-effort base64url decode of the JWT payload `exp` claim. Malformed/missing → `undefined`.
- `src/infrastructure/server/wusoolServerClient.ts` — `serverLogin` and `serverRegister` set
  `expiresAt` on the returned `AuthTokens`.
- `src/app/api/wusool/auth/login/route.ts` and `src/app/api/wusool/actors/route.ts` — store
  `expiresAt` in the vault context alongside the access token.
- `src/app/api/wusool/actions/execute/route.ts` — treat a vault context whose `expiresAt` is in the
  past as missing (→ `needs-auth`), so stale tokens never reach the backend.
- `src/app/api/wusool/auth/logout/route.ts` (+ test) — `POST { env, actorId? }`: clear one actor's
  context (`actorId` given) or the whole environment (`actorId` omitted).

### Browser side
- `src/features/actors/presentation/AuthPromptModal.tsx` — never construct an actor with embedded
  credentials; `onAuthenticated(actorId, email)`; prefill email from `actor.sublabel` when it looks
  like an email.
- `src/app/App.tsx` — `onAuthSuccess(actorId, email)`.
- `src/features/actors/infrastructure/authService.ts` — add `logout(env, actorId?)` calling the BFF
  logout route.
- `src/features/actors/presentation/ActorPanel.tsx` — authenticated non-bus actors show a sign-out
  (🔓) control that clears the vault context (via `logout`), the auth-store flag, and
  `actor.authenticated`.
- `src/features/environments/presentation/EnvironmentModal.tsx` — when the environment actually
  changes (id/baseUrl differs), call `logout(currentEnv)` before applying, clearing old-env vault
  contexts. Admin-token-only edits do not clear actor contexts.
- `src/shared/i18n/en.ts` / `ar.ts` — add `actor.signOut`.

### Tests
- `src/infrastructure/server/jwtExpiry.test.ts` — valid `exp`, missing `exp`, malformed token.
- `src/app/api/wusool/auth/login/route.test.ts` — success stores context in the vault and returns
  only `{authenticated: true}` (no token/password in the response body); 401 failure; 400
  validation; **regression: successful modal login enables the next action** (login route, then the
  execute route runs an auth-required action with the vault token).
- `src/app/api/wusool/auth/logout/route.test.ts` — clears single actor; clears environment;
  validation error.
- `src/app/api/wusool/actions/execute/route.test.ts` — extend with an expired-context case that
  returns `needs-auth` without calling the backend.
- `src/shared/store/auth-security.test.ts` — secret-scanning regression: after workspace add,
  JIT-auth, and sign-out flows, actor-store state, auth-store state, and persisted payloads contain
  no `password`/`token`/`credentials` keys; `safeActor` excludes `raw`.

## Decisions
- **No token refresh yet.** Backend refresh support is unverified (Phase 0 contract); expired tokens
  surface as `needs-auth` and retry only via user-approved continuation. Refresh is gated on the
  verified auth contract.
- **Dev vault retained** as the Phase 1 adapter; production durable vault / HTTP-only session is a
  later gate.
- **Admin token persistence** (`environment.store` → sessionStorage) is Task 1.3 scope; Task 1.2
  secret-scanning covers *actor* credentials/tokens.
- **Removing an actor from the workspace is not sign-out**; only explicit sign-out and environment
  switch clear vault contexts.

## Verification
`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run audit:boundaries`.
Preserve the user-owned `docs/plans/longterm_plan.md` modification (untouched).