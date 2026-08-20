# Task 1.2 hardening — Reliable actor authentication (credential vault)

## Goal
Make JIT actor authentication reliable so a successful login guarantees a usable stored token,
expired access tokens are silently refreshed when a refresh token exists, and the UI never claims
an actor is authenticated when the server vault has no token.

## Why / root causes found
1. **Unvalidated token storage.** `auth/login/route.ts` and `actors/route.ts` store whatever
   `serverLogin`/`serverRegister` return. The contract flags 2FA as a known gap
   (`LoginResponseSchema.requiresTwoFactor`) and tokens are optional/nullable, so a 2FA or
   token-less response stores `{ accessToken: "" }` and *appears to succeed* — every later action
   returns `needs-auth` and the tester retypes in a loop.
2. **No actor refresh.** `actions/execute/route.ts` treats an expired vault context as missing and
   never calls `serverRefresh` even with a valid refresh token. Short-lived JWTs force credential
   re-entry. The refresh endpoint is contract-documented (`RefreshCommandSchema`) and the admin
   path already refreshes (`adminAuth.ts`).
3. **Stale UI state after reload.** `auth.store.ts` persists `authenticated`/`emails` to
   sessionStorage and `actor.store.ts` persists workspace `authenticated` flags, while the vault is
   in-memory and empty after reload (the same reason `environment.store` resets
   `adminConfigured:false` on merge).

## Architecture (mirrors the proven admin pattern)
```
AuthPromptModal / actor creation ─► /auth/login, /actors ─► serverLogin/serverRegister
                                    └ validate non-empty token + 2FA check → vault.setContext
actions/execute ─► actorAuth.resolveActorToken(vault, env, actorId)
                     fresh → token │ near-expiry → silent serverRefresh + re-store │ none → null → needs-auth
auth.store / actor.store ─► in-memory / merge-reset (no stale badges)
```

## Changes

### Server side
- **New `src/infrastructure/server/actorAuth.ts` (+ test)** — `resolveActorToken(vault, env,
  actorId): Promise<string|null>`:
  - missing context → `null`; `expiresAt == null` (opaque token) → return token;
  - not near expiry (`> now + 30s` buffer) → return token;
  - near/expired with `refreshToken` → single in-flight `serverRefresh` per `env:actorId`,
    re-store context (keep old refresh token when non-rotating), return new token;
  - refresh fails / no refresh token → `null` (→ `needs-auth` prompt).
- **`auth/login/route.ts` (+ test)** — validate before storing: `requiresTwoFactor` →
  `AuthenticationError` (401) "two-factor is not supported"; empty `accessToken` →
  `AuthenticationError` (401) "no access token returned"; otherwise `setContext` as today.
- **`actors/route.ts` (+ test)** — passenger registration: empty `accessToken` →
  `AuthenticationError`, no context stored, no falsely-authenticated actor returned.
- **`actions/execute/route.ts` (+ test)** — replace the inline expiry check with
  `resolveActorToken`; `null` → `needs-auth` (unchanged UI contract).
- **`wusoolServerClient.ts`** — `serverLogin`/`serverRegister` surface
  `requiresTwoFactor?: boolean` from the response body.

### Browser side
- **`auth.store.ts`** — drop persistence (in-memory only; empty after reload, consistent with the
  empty vault).
- **`actor.store.ts`** — add a `merge` on rehydrate that resets each persisted workspace actor's
  `authenticated` to `false` (mirrors `environment.store`'s `adminConfigured:false`).
- **i18n (`en.ts`/`ar.ts`)** — add `auth.twoFactorRequired`.

### Tests
- New `actorAuth.test.ts` — fresh token, opaque token (no expiry), near-expiry refresh success
  (vault updated, non-rotating refresh token retained), refresh failure → null, no refresh token →
  null, concurrent refresh deduped.
- `login/route.test.ts` — 2FA → 401 clear message + nothing stored; empty token → 401 + nothing
  stored; existing success/regression updated for the new field.
- `actors/route.test.ts` — passenger register with empty token rejected; nothing stored.
- `execute/route.test.ts` — expired context **with** refresh token → silent refresh + execution;
  refresh failure → `needs-auth`; no refresh token → `needs-auth`.
- `auth-security.test.ts` + store tests — `wusool-auth` no longer persists; actor-store merge
  resets `authenticated`; no secrets anywhere.

## Decisions
- **Reverse Task 1.2's "no refresh yet"**: the refresh endpoint is contract-documented and already
  used by the admin path, so silent server-side actor refresh is contract-backed, not endpoint
  guessing.
- **2FA stays unsupported** but now fails loudly with a clear, translated message instead of silent
  empty-token success (surfaces the Task 0.2-flagged gap).
- **Auth display state is in-memory only** (mirrors `adminConfigured`); after reload the first
  authenticated action re-prompts with a clear reason rather than lying via a stale badge.
- **Dev vault retained**; the production durable vault remains the later Phase 1/6 gate (unchanged).

## Verification
`bun run lint`, `bun run typecheck`, `bun run test`, `bun run audit:boundaries`, `bun run build`.
Preserve user-owned changes (`bun.lock`, `docs/`).
