# Task 0.2 Implementation Plan — Versioned Wusool API Compatibility Contract

Status: ready to implement. Authored 2026-08-17. Source: `docs/plans/longterm_plan.md` Task 0.2.

> Implementer: read `AGENTS.md` and `docs/plans/longterm_plan.md` first. This plan is the working contract for Task 0.2. Do not commit secrets. The raw OpenAPI spec is NOT committed; only this document and code/schemas derived from it.

---

## 1. Goal

Replace inferred, hard-coded endpoint knowledge with a reviewed, versioned contract for the first passenger slice plus supporting discovery/auth/log APIs. Every uncertain operation must be flagged unverified rather than guessed (roadmap Task 0.2; FR-02, FR-03, FR-07, FR-15, FR-31, FR-49–51).

Decisions already agreed with the user:

- Contract source = reachable test backend OpenAPI: `http://38.242.232.201:5002/swagger/v1/swagger.json`.
- Unverified catalog entries (Driver/Bus + unverified Passenger ops) are **flagged**, not removed.
- Contract lives at `docs/contracts/wusool-api-v1.md`; code at `src/infrastructure/contracts/`.
- Raw spec is **not** committed.
- Live contract tests use provided test credentials via **env vars only**; never written to files/logs/commits.

---

## 2. Contract source

- URL: `http://38.242.232.201:5002/swagger/v1/swagger.json` (mirrors `http://38.242.232.201:5002/swagger/index.html`).
- OpenAPI **3.0.1**, title **Wusool API**, **version 1**, **139 paths**.
- Capture date: 2026-08-17. If the spec changes, re-review the contract and bump its version (see §10).
- To re-fetch during implementation:

```bash
curl -s http://38.242.232.201:5002/swagger/v1/swagger.json
```

---

## 3. Verified contract facts (evidence from spec + runtime probes)

### 3.1 Response envelope (verified)

- `ApiResponse<T>`: `{ success: boolean, data: T, message: string, metadata: object, timestamp: string }`
- Lists: `PagedResponse<T>`: `{ items: T[], pagination: PaginationMetadata }`
- `PaginationMetadata`: `{ currentPage, pageSize, totalCount, totalPages, hasNextPage, hasPreviousPage, firstItemIndex, lastItemIndex }`
- **Framework implication:** `WusoolApiClient.unwrap()` (reads `.data`) and list `{ items, pagination }` assumptions are **correct**. Keep them; encode as Zod schemas.

### 3.2 Error shape (verified at runtime)

`ErrorResponse`: `{ success: boolean, message: string, errorCode: string, errors: ValidationError[], metadata, timestamp, path: string, traceId: string }`

Confirmed live: `GET /api/v1/stops` without a token returns HTTP 401 with body
`{"success":false,"message":"Authentication is required to access this resource.","errorCode":"UNAUTHORIZED","errors":[],"metadata":null,"timestamp":"...","path":"/api/v1/stops","traceId":"0HNNSJL8GNVGT:00000001"}`.

- Framework's current error parsing (`message`, `errors[].message`, `errorCode`) is **correct**.
- **Add `traceId` + `path` capture** to `ApiError` — these are the correlation seed (there is no separate correlation header documented in the spec).

### 3.3 Health (verified at runtime)

- `GET /` → HTTP 200 `{"status":"Healthy","checks":[],"duration":"00:00:00.0000060"}`.
- `GET /api/v1/health` → 401 (NOT a health endpoint). Use root `/`.
- Framework `probe(baseUrl)` (GET root) is **correct**.

### 3.4 Authentication (verified)

- Global security: `bearerAuth` on all operations. Login/register/guest operations explicitly set `security: none`.
- All other endpoints return 401 without a bearer token (confirmed live).
- **Role/authorization requirements are NOT declared in the OpenAPI.** Role enforcement must be verified at runtime; treat role claims as unverified until then.
- `POST /api/v1/auth/login` → `LoginCommand{email, password, deviceFingerprint, deviceName}` → 200 `LoginResponse{accessToken, refreshToken, requiresTwoFactor, twoFactorToken, twoFactorMethod}`.
  - **2FA is NOT handled by the framework — flag as a known gap (out of initial-slice scope).**
- `POST /api/v1/auth/driver/login` → `DriverLoginCommand{email, password, deviceFingerprint, deviceName}` → `DriverLoginResponse{accessToken, refreshToken}`.
- `POST /api/v1/auth/guest` → 200 `GuestResponse{accessToken}`.
- `POST /api/v1/auth/register` → 201 `RegisterCommand{fullName, email, password, confirmPassword, deviceFingerprint, name, phone}`.

### 3.5 First-slice passenger endpoints (all verified present in spec)

| Method | Path | Query | Body (Command) | Success | Response payload |
|---|---|---|---|---|---|
| POST | `/api/v1/auth/login` | — | `LoginCommand{email,password,deviceFingerprint,deviceName}` | 200 | `LoginResponse` |
| POST | `/api/v1/auth/guest` | — | — | 200 | `GuestResponse` |
| POST | `/api/v1/auth/register` | — | `RegisterCommand` | 201 | — |
| POST | `/api/v1/admin/drivers` | — | `RegisterDriverCommand{fullName,email,password,confirmPassword,activateUser}` | 201 | `RegisterDriverResponse{driverId,email,fullName,role,isActive}` |
| GET | `/api/v1/admin/users` | `SearchTerm, IsActive, IsVerified, CreatedAfter, CreatedBefore, PageNumber, PageSize, OrderBy, Descending, RoleName` | — | 200 | `PagedResponse<UserDto>` |
| GET | `/api/v1/stops` | `Search, SearchTerm, StopType, IsActive, SortBy, SortDescending, PageNumber, PageSize` | — | 200 | `PagedResponse<StopDto>` |
| GET | `/api/v1/routes` | `Search, SearchTerm, IsActive, RouteType, SortBy, IsSortAscending, MinimumLengthMeters, MaximumLengthMeters, StopId, PageNumber, PageSize` | — | 200 | `PagedResponse<RouteResponse>` |
| GET | `/api/v1/bus-trips` | `RouteId, FromStopId, Date, PageNumber, PageSize` | — | 200 | `PagedResponse<BookableTripDto>` |
| POST | `/api/v1/user-trips` | — | `CreateUserTripCommand{startStopId, endStopId}` | 201 | `CreateUserTripResponse` |
| POST | `/api/v1/user-trips/reserve` | — | `ReserveSeatCommand{busTripId, boardingStopId, alightingStopId}` | 201 | `UserTripDto` |
| GET | `/api/v1/user-trips/me` | `BusTripId, DepartureTime, Rating, StartStopId, EndStopId, Status, PageNumber, PageSize` | — | 200 | `ApiResponse<PagedResponse<System.Object>>` |
| POST | `/api/v1/user-trips/{UserTripId}/cancel` | — | `CancelUserTripCommand{reason}` | — | — |
| POST | `/api/v1/user-trips/{UserTripId}/rating` | — | `RateUserTripCommand{score, comment}` | — | — |
| POST | `/api/v1/favorites` | — | `AddFavoriteCommand{type, targetId}` | 201 | `FavoriteDto` |

Notes:

- Query param names are PascalCase (`PageNumber`, `SearchTerm`); ASP.NET binds case-insensitively, so camelCase framework params (`pageSize`, `routeId`, `fromStopId`, `search`) are fine.
- `GET /user-trips/me` items are typed `System.Object` in the generated spec — the item schema is **ambiguous**. Treat items as `UserTripDto` by convention but capture a real runtime sample during contract testing to confirm.

### 3.6 DTO shapes (verified — build Zod schemas from these)

- `StopDto`: `{ id, name, description, stopType, longitude, latitude, isActive, capacity, hasShelter, hasBench, wheelchairAccessible, created, lastModified }` — **`name` is a flat string.**
- `RouteResponse`: `{ id, shortName, name, nameAr, nameEn, description, path[], routeType, direction, averageDuration, firstDeparture, lastDeparture, frequencyPeak, frequencyOffPeak, isActive }`.
- `BookableTripDto`: `{ id, routeId, routeName, startStopName, endStopName, departureTime, estimatedArrival, capacity, availableSeats, status, busId, busPlate }` — **`routeName` is a flat string.**
- `UserTripDto`: `{ id, busTripId, status, boardingStopId, boardingStopName, alightingStopId, alightingStopName, departureTime, cost, cancelledAt, cancelReason, rating, ratingComment, createdAt }` — **`boardingStopName`/`alightingStopName` are flat strings.**
- `CreateUserTripResponse`: `{ userTripId, userId, busTripId, startStopId, startStopName, endStopId, endStopName, cost, departureTime, arrivalTime, rating, createdAt, status }`.
- `UserTripStatus` enum: `Requested, Assigned, Boarded, Completed, Cancelled`.
- `UserDto`: `{ id*, email*, fullName, phoneNumber, isActive, isVerified, createdAt, lastLoginAt, roles[] }`.
- `BusDto`: `{ id, plateNumber, capacity, vin, seatedCapacity, standingCapacity, brand, model, year, hasAc, hasWifi, hasUsbCharging, fuelType, fuelCapacity, currentKilometers, purchaseDate, purchasePrice, insuranceExpiry, registrationExpiry, lastServiceDate, nextServiceDate, nextServiceKilometers, status, currentDriverId, homeDepotStopId, decommissionedAt, notes }`.
- `BusLocationDto`: `{ busId, longitude, latitude, updatedAt, source }`.
- `DriverShiftDto`: `{ id, driverId, busId, routeId, shiftDate, shiftType, scheduledStart, scheduledEnd, actualStart, actualEnd, checkInTime, checkOutTime, breakDuration, totalHours, overtimeHours, status, substituteDriverId, cancellationReason, incidentsReported, notes }`.
- `IncidentDto`: `{ id, incidentType, severity, busId, driverId, shiftId, incidentDate, locationDescription, description, passengersAffected, injuriesReported, policeReportNumber, insuranceClaimNumber, estimatedDamageCost, downtimeHours, investigationStatus, resolution, preventiveActions, reportedBy, investigatedBy, attachments, resolvedAt }`.
- `FavoriteDto`: `{ id, type, targetId, name, nameAr, createdAt }`.
- `ValidationError`: `{ field, message, errorCode, attemptedValue }`.

### 3.7 Framework mismatches to fix (Task 0.2 scope)

1. **`src/features/actions/infrastructure/entityRepository.ts`** — `Nameful` assumes localized names `{ en, ar }` for stops/trips/bookings. Real DTOs use flat strings (`name`, `routeName`, `boardingStopName`, `alightingStopName`). Labels degrade to `Stop ${id}` etc. Fix mapping per §3.6.
2. **`src/features/actors/infrastructure/actorRepository.ts` `createActor` (Driver)** — `POST /api/v1/admin/drivers` body omits `confirmPassword` (required by `RegisterDriverCommand`) → likely 400. Add it.
3. **`WusoolApiClient.toApiError`** — add `traceId` and `path` capture to `ApiError`.
4. **`ActionDef`** — add `verified: boolean` (+ `contractRef: string`) metadata; flag Driver/Bus actions and role-unverified passenger ops `verified: false`. Execution/UI must exclude `verified: false` actions.
5. **`authService.ts`** — currently correct for token extraction (`accessToken`). Note 2FA gap in the contract doc; do not implement 2FA in this task.

### 3.8 Unverified / unavailable (do NOT guess)

- Per-role authorization requirements (not in OpenAPI; runtime verification needed).
- Backend-log retrieval API — **not present** in the spec. Mark unavailable/unknown (Phase 3 concern).
- Correlation-header propagation mechanism — only `ErrorResponse.traceId` is documented. No dedicated header contract.
- `GET /user-trips/me` item schema (`System.Object`).
- Driver/Bus action runtime behavior (endpoints exist in spec but are out of the initial slice; flag unverified).

---

## 4. Deliverables

### 4.1 `docs/contracts/wusool-api-v1.md` (new)

Versioned contract document containing:

- §2 source/version/capture date (reuse content above).
- §3 envelope, error, health, auth, endpoint matrix, DTO shapes, unverified list.
- Versioning policy (§10) and sign-off checklist (§11).

### 4.2 `src/infrastructure/contracts/` (new, pure TypeScript)

No React, Next.js, Zustand, browser APIs, or Leaflet imports (keeps Task 0.3 boundaries clean). `@/` alias available.

- `schemas/`:
  - `apiResponse.ts` — `ApiResponse`, `PagedResponse`, `PaginationMetadata`.
  - `errorResponse.ts` — `ErrorResponse`, `ValidationError`.
  - `auth.ts` — `LoginCommand`, `LoginResponse`, `GuestResponse`, `RegisterCommand`, `RegisterDriverCommand`, `DriverLoginCommand`, `DriverLoginResponse`.
  - `actor.ts` — `UserDto`, `BusDto`, `BusLocationDto`.
  - `entity.ts` — `StopDto`, `RouteResponse`, `BookableTripDto`, `UserTripDto`, `CreateUserTripResponse`, `FavoriteDto`, `DriverShiftDto`, `IncidentDto`.
  - `commands.ts` — `CreateUserTripCommand`, `ReserveSeatCommand`, `CancelUserTripCommand`, `RateUserTripCommand`, `AddFavoriteCommand`.
  - `enums.ts` — `UserTripStatus`, `UserTripStatusSchema`, plus any other enum schemas needed.
- `endpointContract.ts` — registry: `EndpointContract { actionId, verified, method, path, auth, queryParams, requestSchema, responseSchema }`. This is the single source of truth mapping action ids → verified endpoints.
- `mappers/` — first-slice DTO → framework model mappers (fix flat-name bugs):
  - `stopMapper` → `EntityOption { value: string(id), label: name, raw }`.
  - `tripMapper` (BookableTripDto) → `EntityOption` (label: `routeName · departureTime`).
  - `bookingMapper` (UserTripDto) → `EntityOption` (label: `boardingStopName → alightingStopName · status`).
  - `userMapper` (UserDto) → actor fields; `busMapper` (BusDto) → actor fields.
- `__fixtures__/` — anonymized sample DTOs (hand-built from §3.6 shapes; do NOT use real credentials/data). Each fixture asserted to parse against its schema in tests.

### 4.3 Framework reconciliation (edits)

- `src/features/actions/domain/action.types.ts` — add `verified: boolean` and `contractRef?: string` to `ActionDef`.
- `src/features/actions/application/actionCatalog.ts` — set `verified` on every action; `false` for Driver/Bus + role-unverified passenger ops. Add a helper `verifiedActionsForActor(...)` (or filter in callers).
- `src/features/actions/application/actionCatalog.test.ts` — update to the new flagged state.
- `src/features/actions/infrastructure/entityRepository.ts` — use contract mappers; remove wrong `Nameful` localized-name assumptions.
- `src/features/actors/infrastructure/actorRepository.ts` — add `confirmPassword` to driver create body.
- `src/infrastructure/http/WusoolApiClient.ts` — extend `ApiError` with `traceId`/`path`.
- Presentation/execution — ensure `verified: false` actions are not executable/listable. Check callers of `actionsForActor` (e.g. `ActionPanel.tsx`, `ActionCategory` views). If flagging would require a broad UI change, keep the UI change minimal (filter out unverified) and note any deferred UI in the doc.

---

## 5. Tests

Add/update under the existing Vitest setup (`vitest.config.mts`, `src/**/*.test.ts`):

1. **Schema-parsing tests** — every fixture in `__fixtures__/` parses against its schema; invalid samples rejected.
2. **Registry-completeness test** — every `verified: true` `ActionDef` resolves to a registered `EndpointContract`; every executable action is verified; no `verified: false` action is executable.
3. **Mapper tests** — DTO → domain label mapping for stops/trips/bookings/users/buses (flat-name cases included).
4. **Error mapping test** — `ApiError` extracts `traceId`/`path` from an `ErrorResponse`-shaped body.
5. **`bun run test:contract`** — consumer-driven contract tests, gated so they do not run by default:
   - Script: `"test:contract": "vitest run --config vitest.contract.config.mts"` (new config including `src/infrastructure/contracts/**/*.contract.test.ts`).
   - Reads `WUSOOL_CONTRACT_BASE_URL` (default the pinned test env). **Abort if unset or if the URL matches a production pattern** (e.g. contains `prod`/`production`, or an allowlist match — define a conservative allowlist).
   - Auth: `WUSOOL_CONTRACT_ADMIN_EMAIL` / `WUSOOL_CONTRACT_ADMIN_PASSWORD` (env-only). Flow: `POST /auth/login` → admin token → assert `GET /admin/users`, `GET /stops`, `GET /routes`, `GET /bus-trips`, `GET /buses` responses parse against schemas. Do NOT log the token.
   - Passenger booking flow requires a passenger credential. If none is supplied, skip those assertions with a clear "skipped: passenger credentials not provided" notice rather than failing.
   - Never run against production. Never write credentials/fixtures from live data without anonymizing.

---

## 6. Verification commands

```bash
bun run lint
bun run typecheck
bun run test
bun run build
# live contract tests (only when creds are set):
WUSOOL_CONTRACT_ADMIN_EMAIL=... WUSOOL_CONTRACT_ADMIN_PASSWORD=... bun run test:contract
```

---

## 7. Acceptance criteria

- All first-slice requests/responses are documented in `docs/contracts/wusool-api-v1.md`.
- All first-slice DTOs are Zod-schema-validated and contract-tested.
- Unsupported/uncertain catalog entries are flagged `verified: false` and non-executable.
- The four standard commands pass; contract tests pass (or skip explicitly) against the approved test env.
- No secrets anywhere in the repo.

---

## 8. Potential pitfalls

- Do not silently change backend contracts; everything uncertain stays flagged.
- Never commit the admin credentials or any token. Logs and exports must not contain them.
- `GET /user-trips/me` items are `System.Object` in the spec — do not assert an item schema from the spec alone; use a runtime sample.
- Do not weaken or bypass backend auth to make tests pass (AGENTS.md).
- Keep `src/infrastructure/contracts/` free of React/Next/browser imports (Task 0.3 dependency).
- The backend repo is read-only (`D:\projects\wusool-api`); never modify it.

---

## 9. Out of scope (later phases)

- Ports/interfaces, redaction policy, session-recorder envelope → Task 0.3.
- BFF route handlers, server client, vault → Phase 1.
- Passenger actor/entity use cases, registry-driven executor → Phase 2.
- Session recording/investigation, log retrieval → Phase 3.
- Driver/Bus contract documentation → later (flag unverified for now).
- 2FA handling → future, once backend contract confirms the flow.

---

## 10. Versioning policy (draft — needs backend-owner sign-off)

- The contract is pinned to backend spec version 1 (`swagger/v1/swagger.json`).
- Contract file naming: `wusool-api-v<backend-spec-version>.md`.
- Any change to the backend spec (paths, DTOs, auth, versions) triggers a contract re-review; changes are additive or explicitly versioned; breaking changes bump the backend spec version and require a new contract document + sign-off.
- This policy is provisional until the backend owners approve it (record approval in the contract doc).

---

## 11. Sign-off checklist (record in `docs/contracts/wusool-api-v1.md`)

- [ ] Backend spec source and version captured (URL + date).
- [ ] Envelope/error/pagination schemas documented and schema-validated.
- [ ] First-slice endpoint matrix complete and contract-tested against the approved test env.
- [ ] Unverified operations flagged `verified: false`; nothing executable is unverified.
- [ ] Mapper/registration bugs fixed per §3.7.
- [ ] Backend owners approve versioning policy and role/authorization assumptions.
- [ ] Credentials: none committed; env-only; logs sanitized.

---

## 12. Recommended implementation order

1. Re-fetch the spec (optional; shapes are in §3).
2. Write `docs/contracts/wusool-api-v1.md`.
3. Build `src/infrastructure/contracts/schemas/`, `endpointContract.ts`, `mappers/`, `__fixtures__/`.
4. Schema/mapper/registry tests.
5. Framework reconciliation edits (§4.3) + test updates.
6. `vitest.contract.config.mts` + `test:contract` script + contract tests; verify against the test env with env-supplied credentials.
7. Run all verification commands; mark the sign-off checklist accordingly.