# Redaction Policy

Centralized sanitization rules for the Wusool Testing Framework. Redaction must
run **before** any request, response, or event is persisted, exported, or
returned to the browser. Source of truth for the rules: `src/shared/redaction/redact.ts`.

## 1. Sensitive fields

Values under these key names (matched case-insensitively) are replaced with `REDACTED`:

- `password`, `passwd`, `confirmPassword`
- `token`, `accessToken`, `refreshToken`, `tokenType`
- `secret`, `credentials`
- `authorization`
- `apiKey`, `x-api-key`, `api-key`
- `cookie`, `set-cookie`
- `session`

Any future field whose name contains one of these patterns is treated as sensitive
by default. The pattern lives in one place (`SENSITIVE_KEY`) so it is auditable.

## 2. What is redacted

- **Headers**: header *names* matching the pattern and their values (e.g.
  `Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key`).
- **Request/response bodies**: nested objects and arrays; sensitive values are
  replaced; non-sensitive structure is preserved.
- **Query strings**: values under sensitive query keys.

## 3. Where redaction is enforced

- **Session recording boundary** (now): `src/shared/store/session.store.ts`
  sanitizes request/response before building a `SessionEvent`.
- **Session export** (Phase 3): exported `.wusool-session` files must contain
  only sanitized evidence.
- **BFF responses** (Phase 1): Next route handlers must not return raw upstream
  headers or secrets to the browser.

## 4. Data ownership rules

- Tokens and credentials never enter React state, Zustand persistence, URLs,
  logs, session events, or exports.
- Domain/application interfaces return safe plain models. Infrastructure
  mappers must project away `token`, `credentials`, and raw backend snapshots.
- `CredentialVault.resolve()` returns an `AuthContext` that is **server-side
  only**; it must never cross to presentation, domain events, or exports.

## 5. Known debt (tracked, not hidden)

The current prototype still violates data ownership and must be migrated during
Phases 1–2 (roadmap tasks 1.1–1.3, 2.1):

- `ActorRef` (`src/features/actors/domain/actor.types.ts`) carries
  `credentials` (incl. `password`) and `token`.
- `actor.store.ts` persists the workspace (tokens/passwords) to `localStorage`.
- `auth.store.ts` and `environment.store.ts` persist tokens and `adminToken` to
  `sessionStorage`.

These are removed/isolated by the Phase 1 BFF and credential-vault work, not by
this task. Until then, the recording-boundary redaction in §3 guarantees stored
session evidence stays clean.