# Task 4.3 — Build deterministic constant-speed automated movement use case

## Goal

Move an actor along a drawn route through a cancellable, testable application-level engine
(`MoveActorAlongRoute`) that interpolates position by distance/time at constant speed and sends
verified location updates to the Wusool backend at a fixed, conservative frequency — replacing the
current interval-in-component `createRouteFollower`.

## Context

- **Dependencies (done)**: Task 4.1 (route drawing, map store) and Task 4.2 (manual driver
  drag → confirm → SignalR location update via `LocationPort`) are complete.
- **Current movement**: `src/features/map/application/movement.ts` hops vertex-to-vertex by index on
  a raw `setInterval`; it is created inside a `useEffect` in `MapCanvas.tsx` (timer loop in a React
  component). It has no injected clock, no distance/time interpolation, no start/cancel events, no
  per-update failure behavior, and never sends locations to the backend during movement.
- **Backend transport**: driver location is SignalR-only (`DriverHub.UpdateLocation` via
  `LocationPort`, browser-direct connection; token resolved server-side by the BFF). There is no
  REST catalog action for it, so movement sends go through the same `LocationPort` behind a shared
  application use case rather than the HTTP action executor.
- **Rate limits**: no approved backend rate limit exists yet (roadmap open question #6), so the send
  frequency is a conservative module constant (`DEFAULT_SEND_INTERVAL_MS = 1000`), easy to change
  once agreed. Movement speed is tester-configurable.
- **Recording**: the session recorder already supports `position`; static history paths render
  automatically from recorded positions (`buildStaticPaths`).
- **Decisions** (approved): unify manual + automated sends through one application use case;
  reinterpret the speed control as km/h with distance/time interpolation; default failure policy is
  stop-on-first-failed-send (configurable); every backend send is recorded as a session event.

## Requirements mapping

- FR-11 (drawn routes) / FR-12 (automated constant movement, no GPS noise/acceleration/heading/
  traffic) / FR-30 (workflow-reusable automated movement).
- Acceptance: movement is cancellable, deterministic, backend-observable, session-recorded, and
  reusable by workflows (programmatic API; workflow engine itself is Phase 5).

## Implementation Plan

### Step 1 — Route geometry helpers (domain)

**File to create:** `src/features/map/domain/distance.ts`

- `haversineMeters(a, b)` — great-circle distance (R = 6_371_008.8 m).
- `cumulativeDistances(route)` — prefix-sum segment lengths.
- `positionAtDistance(route, cum, meters)` — linear interpolation along the polyline; clamps to
  route bounds; guards zero-length segments.
- `routeLengthMeters(route)`.

Pure TypeScript; no framework imports (satisfies `audit:boundaries`).

### Step 2 — Movement engine rewrite (application)

**File to rewrite:** `src/features/map/application/movement.ts`

- `MovementScheduler` port: `{ setTimeout, clearTimeout, now }` + `createRealScheduler()` default.
  Injected in tests (fake clock) — no raw timers owned by consumers.
- `startMoveActorAlongRoute(input, deps): MovementHandle`
  - `input`: `route`, `speedKmh`, optional `sendIntervalMs` (default `DEFAULT_SEND_INTERVAL_MS`),
    `failurePolicy: "stop" | "continue"` (default `"stop"`).
  - `deps.sendLocation(pos): Promise<LocationUpdateResult>` — host-bound transport.
  - Events: `onStarted`, `onPosition` (UI-throttled ticks, includes initial synchronous position),
    `onSendCompleted(pos, result)` (success and failure both), `onEnded(outcome)` where outcome is
    `{ type: "completed" | "cancelled" | "failed", position, error? }`.
  - Behavior: self-rescheduling absolute-time tick loop with drift correction; interpolated target
    distance = speed × elapsed; final endpoint is sent exactly once (deduped against last send);
    `cancel()` stops immediately (even mid-await) and emits `cancelled`; failed send under `"stop"`
    ends the run as `failed`; under `"continue"` the run proceeds and failures are reported per send.
- Old `createRouteFollower` / `stepAlongRoute` / `isMovable` / `routeEnd` are removed.

### Step 3 — Unified location-send use case (application)

**File to create:** `src/features/map/application/sendActorLocation.ts`

- `sendActorLocation({ actorId, lat, lng, envRef, locationPort })` → `LocationUpdateResult`.
- Validates coordinate bounds/finite values first (returns a validation-classified failure instead
  of hitting the hub).
- Used by BOTH the manual confirm flow (Task 4.2 path) and the movement engine — AGENTS §13 single
  execution system for manual and automated actions.

### Step 4 — Store: real speed semantics

**File to modify:** `src/shared/store/map.store.ts`

- Rename `speed` (ms between vertex hops) → `speedKmh` (default `30`); `setSpeedKmh`.
- `resetForEnvironment()` unchanged (flips `following:false`; component cancels the active run).

### Step 5 — Presentation wiring

**Files to modify:** `MapCanvas.tsx`, `features/map/index.ts`, i18n `en.ts` / `ar.ts`

- Replace the follower `useEffect` with engine lifecycle management (create handle on start,
  cancel on stop/unmount/environment change — explicit `cancel()` before SignalR disconnect so the
  cancelled event records against the old environment).
- Reporter maps engine events → `SessionRecorder.record(...)` with dict-key summaries:
  started (info), each backend send (success/failure, with position), completed / cancelled /
  failed. No handwritten UI text; new keys added to both locales.
- Manual confirm flow refactored to call `sendActorLocation`.
- `SpeedControl` becomes km/h input (min 5, max 120, step 5); labels updated
  (`map.speed` → "Speed (km/h)" / "السرعة (كم/ساعة)", hint updated to mention ~1 s backend cadence).

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `docs/plans/task-4.3-plan.md` | Create | This plan |
| `src/features/map/domain/distance.ts` | Create | Haversine/polyline interpolation helpers |
| `src/features/map/domain/distance.test.ts` | Create | Geometry unit tests |
| `src/features/map/application/movement.ts` | Rewrite | Injected-scheduler constant-speed engine |
| `src/features/map/application/movement.test.ts` | Rewrite | Fake-clock timing/interpolation/cancel/failure tests |
| `src/features/map/application/sendActorLocation.ts` | Create | Unified manual+automated send use case |
| `src/features/map/application/sendActorLocation.test.ts` | Create | Validation/delegation tests |
| `src/features/map/application/movement.integration.test.ts` | Create | Send cadence, payloads, failure policies, multi-actor/perf smoke |
| `src/shared/store/map.store.ts` | Modify | `speedKmh` |
| `src/shared/store/map.store.test.ts` | Modify | Speed semantics tests |
| `src/features/map/index.ts` | Modify | Export new movement API |
| `src/features/map/presentation/MapCanvas.tsx` | Modify | Engine wiring, env cancellation, unified manual send |
| `src/shared/i18n/en.ts` / `ar.ts` | Modify | Speed/movement lifecycle keys |

## Known limitations

- Send frequency is a conservative constant pending an approved backend rate limit (roadmap open
  question #6); change `DEFAULT_SEND_INTERVAL_MS` when agreed.
- As in Task 4.2, `UpdateLocation` silently ignores updates for drivers without an active bus; the
  framework reports "accepted".
- Workflow steps referencing movement arrive in Phase 5; this task delivers the reusable programmatic
  API only.

## Implementation notes (as-built)

- The engine emits `onStarted` on its first processed tick (~100 ms after start) and a run cancelled
  before any tick processes stops **silently** (no events). This keeps React StrictMode's dev
  double-mount from leaving phantom started/cancelled pairs in the session timeline.
- Results of sends that are in flight during cancellation are dropped silently rather than recorded;
  the replacing run re-sends the same starting position.
- Restarting movement (speed change mid-run) restarts from the route start — same semantics as the
  pre-existing follower effect.

## Verification

1. `bun run lint`
2. `bun run typecheck`
3. `bun run test`
4. `bun run audit:boundaries`
5. `bun run build`
6. Manual: draw route → Play → marker moves smoothly at configured km/h, backend receives ~1 update/s,
   timeline shows start/send/completed events with positions; Stop cancels immediately; environment
   switch cancels and records the cancellation.
