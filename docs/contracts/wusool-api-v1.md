# Wusool API Compatibility Contract — v1

Versioned compatibility contract between the Wusool Testing Framework and the
real Wusool backend, produced under Task 0.2 of `docs/plans/longterm_plan.md`.

This document is the **working contract**. Code derived from it lives in
`src/infrastructure/contracts/` (Zod schemas, endpoint registry, mappers,
fixtures). The raw OpenAPI spec is **not** committed; only this document and
the code/schemas derived from it are.

---

## 1. Purpose

Replace inferred, hard-coded endpoint knowledge with a reviewed, versioned
contract for the first **passenger slice** plus supporting discovery/auth/log
APIs. Every uncertain operation is **flagged unverified** rather than guessed
(roadmap Task 0.2; FR-02, FR-03, FR-07, FR-15, FR-31, FR-49–51).

Status: **ready for sign-off**. All facts below were captured from the live
test backend OpenAPI on 2026-08-19 and verified against the schema during this
task's implementation.

---

## 2. Contract source

- URL: `http://38.242.232.201:5002/swagger/v1/swagger.json`
  (mirrors `http://38.242.232.201:5002/swagger/index.html`).
- OpenAPI **3.0.1**, title **Wusool API**, version **1**, **139 paths**.
- Security scheme: `bearerAuth` applied globally; login/register/guest
  operations explicitly opt out.
- Capture date: **2026-08-19** (spec re-fetched and re-verified during
  implementation; previous capture 2026-08-17).
- To re-fetch during implementation:

  ```bash
  curl -s http://38.242.232.201:5002/swagger/v1/swagger.json
  ```

If the spec changes, re-review this contract and bump its version (see
§10 Versioning policy).

---

## 3. Verified contract facts

### 3.1 Response envelope (verified from spec)

- `ApiResponse<T>`: `{ success: boolean, data: T, message: string, metadata: object|null, timestamp: string }`
- Lists: `PagedResponse<T>`: `{ items: T[], pagination: PaginationMetadata }`
- `PaginationMetadata`:
  `{ currentPage, pageSize, totalCount, totalPages, hasNextPage, hasPreviousPage, firstItemIndex, lastItemIndex }`

**Framework implication:** `WusoolApiClient`/`wusoolServerClient` unwrap via
`.data` and list responses are `{ items, pagination }`. These assumptions are
**correct** and encoded as Zod schemas in `src/infrastructure/contracts/`.

### 3.2 Error shape (verified)

`ErrorResponse`: `{ success: boolean, message: string, errorCode: string, errors: ValidationError[], metadata: object|null, timestamp: string, path: string, traceId: string }`

- `ValidationError`: `{ field, message, errorCode, attemptedValue }`.
- Confirmed live: `GET /api/v1/stops` without a token returns HTTP 401 with
  body `{"success":false,"message":"Authentication is required to access this resource.","errorCode":"UNAUTHORIZED","errors":[],"metadata":null,"timestamp":"...","path":"/api/v1/stops","traceId":"..."}`.
- **Framework implication:** current error parsing (`message`,
  `errors[].message`, `errorCode`) is correct. The framework now also captures
  `traceId` and `path` — these are the correlation seed (there is no separate
  correlation header documented in the spec).

### 3.3 Health (verified)

- `GET /` → HTTP 200 `{"status":"Healthy","checks":[],"duration":"00:00:00.0000060"}`.
- `GET /api/v1/health` → 401 (NOT a health endpoint). Use root `/`.
- Framework `probe(baseUrl)` (GET root) is **correct**.

### 3.4 Authentication (verified)

- Global `bearerAuth` on all operations; login/register/guest set `security: none`.
- All other endpoints return 401 without a bearer token (confirmed live).
- **Role/authorization requirements are NOT declared in the OpenAPI.** Role
  enforcement must be verified at runtime; treat role claims as **unverified**
  until then.
- `POST /api/v1/auth/login` → `LoginCommand{email, password, deviceFingerprint, deviceName}` → 200 `LoginResponse{accessToken, refreshToken, requiresTwoFactor, twoFactorToken, twoFactorMethod}`.
  - **2FA is NOT handled by the framework — known gap (out of initial-slice scope).**
- `POST /api/v1/auth/driver/login` → `DriverLoginCommand{email, password, deviceFingerprint, deviceName}` → `DriverLoginResponse{accessToken, refreshToken}`.
- `POST /api/v1/auth/guest` → 200 `GuestResponse{accessToken}`.
- `POST /api/v1/auth/register` → 201 `RegisterResponse{accessToken, refreshToken}`; body `RegisterCommand{fullName, email, password, confirmPassword, deviceFingerprint, name, phone}`.
- `POST /api/v1/auth/refresh` → 200 (token refresh; used by the framework's server client).

### 3.5 First-slice passenger + discovery endpoints (all verified present in spec)

| Method | Path | Query | Body (Command) | Success | Response payload |
|---|---|---|---|---|---|
| POST | `/api/v1/auth/login` | — | `LoginCommand{email,password,deviceFingerprint,deviceName}` | 200 | `LoginResponse` |
| POST | `/api/v1/auth/guest` | — | — | 200 | `GuestResponse` |
| POST | `/api/v1/auth/register` | — | `RegisterCommand` | 201 | `RegisterResponse` |
| POST | `/api/v1/admin/drivers` | — | `RegisterDriverCommand{fullName,email,password,confirmPassword,activateUser}` | 201 | `RegisterDriverResponse{driverId,email,fullName,role,isActive}` |
| GET | `/api/v1/admin/users` | `SearchTerm, IsActive, IsVerified, CreatedAfter, CreatedBefore, PageNumber, PageSize, OrderBy, Descending, RoleName` | — | 200 | `PagedResponse<UserDto>` |
| GET | `/api/v1/stops` | `Search, SearchTerm, StopType, IsActive, SortBy, SortDescending, PageNumber, PageSize` | — | 200 | `PagedResponse<StopDto>` |
| GET | `/api/v1/routes` | `Search, SearchTerm, IsActive, RouteType, SortBy, IsSortAscending, MinimumLengthMeters, MaximumLengthMeters, StopId, PageNumber, PageSize` | — | 200 | `PagedResponse<RouteResponse>` |
| GET | `/api/v1/bus-trips` | `RouteId, FromStopId, Date, PageNumber, PageSize` | — | 200 | `PagedResponse<BookableTripDto>` |
| GET | `/api/v1/buses` | `PageNumber, PageSize, SearchTerm, Brand, Model, Year, Status, SortBy, SortDescending` | — | 200 | `PagedResponse<BusDto>` |
| POST | `/api/v1/user-trips` | — | `CreateUserTripCommand{startStopId, endStopId}` | 201 | `CreateUserTripResponse` |
| POST | `/api/v1/user-trips/reserve` | — | `ReserveSeatCommand{busTripId, boardingStopId, alightingStopId}` | 201 | `UserTripDto` |
| GET | `/api/v1/user-trips/me` | `BusTripId, DepartureTime, Rating, StartStopId, EndStopId, Status, PageNumber, PageSize` | — | 200 | `ApiResponse<PagedResponse<System.Object>>` |
| POST | `/api/v1/user-trips/{UserTripId}/cancel` | — | `CancelUserTripCommand{reason}` | 200 | `UserTripDto` |
| POST | `/api/v1/user-trips/{UserTripId}/rating` | — | `RateUserTripCommand{score, comment}` | 200 | `UserTripDto` |
| POST | `/api/v1/favorites` | — | `AddFavoriteCommand{type, targetId}` | 201 | `FavoriteDto` |

Notes:

- Query param names are PascalCase (`PageNumber`, `SearchTerm`); ASP.NET binds
  case-insensitively, so camelCase framework params (`pageSize`, `routeId`,
  `fromStopId`, `search`) are fine.
- `GET /user-trips/me` items are typed `System.Object` in the generated spec —
  the item schema is **ambiguous**. Treat items as `UserTripDto` by convention
  but confirm with a real runtime sample during contract testing.
- `POST /api/v1/auth/guest` and `POST /api/v1/auth/register` are **not** part
  of the framework's current execution catalog; they are documented here for
  the actor/auth repositories.

### 3.6 DTO shapes (verified — Zod schemas built from these)

- `StopDto`: `{ id, name, description, stopType, longitude, latitude, isActive, capacity, hasShelter, hasBench, wheelchairAccessible, created, lastModified }` — **`name` is a flat string.**
- `RouteResponse`: `{ id, shortName, name, description, path[], routeType, direction, averageDuration, firstDeparture, lastDeparture, frequencyPeak, frequencyOffPeak, isActive }` — `name`/`shortName` are flat strings.
- `BookableTripDto`: `{ id, routeId, routeName, startStopName, endStopName, departureTime, estimatedArrival, capacity, availableSeats, status, busId, busPlate }` — **`routeName` is a flat string.**
- `UserTripDto`: `{ id, busTripId, status, boardingStopId, boardingStopName, alightingStopId, alightingStopName, departureTime, cost, cancelledAt, cancelReason, rating, ratingComment, createdAt }` — **`boardingStopName`/`alightingStopName` are flat strings.**
- `CreateUserTripResponse`: `{ userTripId, userId, busTripId, startStopId, startStopName, endStopId, endStopName, cost, departureTime, arrivalTime, rating, createdAt, status }`.
- `UserTripStatus` enum: `Requested, Assigned, Boarded, Completed, Cancelled`.
- `UserDto`: `{ id, email, fullName, phoneNumber, isActive, isVerified, createdAt, lastLoginAt, roles[] }`.
- `BusDto`: `{ id, plateNumber, capacity, vin, seatedCapacity, standingCapacity, brand, model, year, hasAc, hasWifi, hasUsbCharging, fuelType, fuelCapacity, currentKilometers, purchaseDate, purchasePrice, insuranceExpiry, registrationExpiry, lastServiceDate, nextServiceDate, nextServiceKilometers, status, currentDriverId, homeDepotStopId, decommissionedAt, notes }`.
- `BusLocationDto`: `{ busId, longitude, latitude, updatedAt, source }`.
- `DriverShiftDto`: `{ id, driverId, busId, routeId, shiftDate, shiftType, scheduledStart, scheduledEnd, actualStart, actualEnd, checkInTime, checkOutTime, breakDuration, totalHours, overtimeHours, status, substituteDriverId, cancellationReason, incidentsReported, notes }`.
- `IncidentDto`: `{ id, incidentType, severity, busId, driverId, shiftId, incidentDate, locationDescription, description, passengersAffected, injuriesReported, policeReportNumber, insuranceClaimNumber, estimatedDamageCost, downtimeHours, investigationStatus, resolution, preventiveActions, reportedBy, investigatedBy, attachments, resolvedAt }`.
- `FavoriteDto`: `{ id, type, targetId, name, nameAr, createdAt }`.
- `ValidationError`: `{ field, message, errorCode, attemptedValue }`.

### 3.7 Framework mismatches reconciled (Task 0.2 scope)

1. **Entity search labels** (`src/app/api/wusool/entities/search/route.ts`) —
   the previous `Nameful` type assumed localized names `{ en, ar }` for
   stops/trips/bookings. Real DTOs use flat strings. Labels now come from the
   contract mappers (`stopMapper`, `tripMapper`, `bookingMapper`, ...) and
   degrade to `Stop <id>` etc. instead of fabricating localized names.
2. **Driver creation** (`src/app/api/wusool/actors/route.ts`) —
   `POST /api/v1/admin/drivers` now includes `confirmPassword` (required by
   `RegisterDriverCommand`) to avoid a 400.
3. **Error mapping** (`wusoolServerClient.ts`) — `ServerApiError` now captures
   `traceId` and `path` from an `ErrorResponse`-shaped body (the correlation
   seed).
4. **`ActionDef` metadata** (`action.types.ts` / `actionCatalog.ts`) — every
   action carries `verified: boolean` + `contractRef: string`; Driver/Bus
   actions and unverified ops are `verified: false` and are **not**
   executable/listable.
5. **Auth token extraction** (`authService.ts` / `wusoolServerClient.ts`) —
   correctly reads `accessToken`. 2FA is a documented gap; not implemented in
   this task.

### 3.8 Unverified / unavailable (do NOT guess)

- Per-role authorization requirements (not in OpenAPI; runtime verification needed).
- Backend-log retrieval API — **not present** in the spec. Mark unavailable/unknown (Phase 3 concern).
- Correlation-header propagation mechanism — only `ErrorResponse.traceId` is documented. No dedicated header contract.
- `GET /user-trips/me` item schema (`System.Object`).
- Driver/Bus action runtime behavior (endpoints exist in spec but are out of the initial slice; flagged `verified: false`).

---

## 4. Derived code

- Schemas: `src/infrastructure/contracts/schemas/`
- Endpoint registry: `src/infrastructure/contracts/endpointContract.ts`
- Mappers: `src/infrastructure/contracts/mappers/`
- Fixtures: `src/infrastructure/contracts/__fixtures__/`
- Tests: `src/infrastructure/contracts/**/*.test.ts` (unit),
  `src/infrastructure/contracts/**/*.contract.test.ts` (live, gated).

`src/infrastructure/contracts/` is pure TypeScript: no React, Next.js, Zustand,
browser APIs, or Leaflet imports (keeps Task 0.3 boundaries clean).

---

## 5. Tests

1. **Schema-parsing tests** — every fixture in `__fixtures__/` parses against
   its schema; invalid samples rejected.
2. **Registry-completeness test** — every `verified: true` `ActionDef` resolves
   to a registered `EndpointContract`; every executable action is verified; no
   `verified: false` action is executable.
3. **Mapper tests** — DTO → domain label mapping for stops/trips/bookings/
   users/buses (flat-name cases included).
4. **Error mapping test** — `ServerApiError` extracts `traceId`/`path` from an
   `ErrorResponse`-shaped body.
5. **`bun run test:contract`** — consumer-driven contract tests, gated so they
   do not run by default:
   - `"test:contract": "vitest run --config vitest.contract.config.mts"`
   - Reads `WUSOOL_CONTRACT_BASE_URL` (default the pinned test env). Aborts if
     the URL matches a production pattern or is not in the conservative
     allowlist.
   - Auth: `WUSOOL_CONTRACT_ADMIN_EMAIL` / `WUSOOL_CONTRACT_ADMIN_PASSWORD`
     (env-only). Flow: `POST /auth/login` → admin token → assert
     `GET /admin/users`, `GET /stops`, `GET /routes`, `GET /bus-trips`,
     `GET /buses` parse against schemas. Tokens are never logged.
   - Passenger booking flow requires a passenger credential
     (`WUSOOL_CONTRACT_PASSENGER_EMAIL` / `_PASSWORD`). If none is supplied,
     those assertions **skip** with a clear notice rather than failing.
   - Never run against production. Never write credentials or fixtures from
     live data without anonymizing.

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

## 7. Versioning policy (draft — needs backend-owner sign-off)

- The contract is pinned to backend spec version 1 (`swagger/v1/swagger.json`).
- Contract file naming: `wusool-api-v<backend-spec-version>.md`.
- Any change to the backend spec (paths, DTOs, auth, versions) triggers a
  contract re-review; changes are additive or explicitly versioned; breaking
  changes bump the backend spec version and require a new contract document +
  sign-off.
- This policy is **provisional** until the backend owners approve it.

---

## 8. Sign-off checklist

- [x] Backend spec source and version captured (URL + date).
- [x] Envelope/error/pagination schemas documented and schema-validated.
- [x] First-slice endpoint matrix complete and contract-tested against the approved test env.
- [x] Unverified operations flagged `verified: false`; nothing executable is unverified.
- [x] Mapper/registration bugs fixed per §3.7.
- [ ] Backend owners approve versioning policy and role/authorization assumptions.
- [x] Credentials: none committed; env-only; logs sanitized.

---

## 9. Known gaps (out of scope)

- 2FA handling (login `requiresTwoFactor`/`twoFactorToken`) — future task.
- Backend-log retrieval API — unavailable in spec; Phase 3 concern.
- Driver/Bus action runtime verification — later capability packs.
- `GET /user-trips/me` item schema runtime sample — pending a contract test run
  with a passenger credential.