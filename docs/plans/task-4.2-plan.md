# Task 4.2 — Implement manual backend location operation

## Goal

Distinguish visual placement from a deliberate, verified location update sent to Wusool via SignalR.

## Context

- **SignalR hub**: `/Bus/driver` → `DriverHub` — bidirectional send/receive for driver location
  *(verified against backend `Program.cs`; `/Bus/location/trip` hosts `BusLocationHub`, a different hub without `UpdateLocation`)*
- **Hub method**: `UpdateLocation(latitude, longitude)` — Driver sends location via SignalR; bus resolved server-side from the token's driver claims
- **Auth**: Same bearer token as REST endpoints (`[Authorize]` hub; JWT config whitelists both hub paths for `access_token` extraction)
- **Actor type**: Driver only sends location via SignalR
- **Current state**: Map drag/drop updates local state only; no backend confirmation flow exists; `@microsoft/signalr` is not installed

## Implementation Plan

### Step 1: Install `@microsoft/signalr`

- Add `@microsoft/signalr` to dependencies
- Verify installation works with `bun install`

### Step 2: Create SignalR infrastructure (`src/infrastructure/signalr/`)

**Files to create:**
- `src/infrastructure/signalr/signalrClient.ts` — Connection manager (connect/disconnect/send)
- `src/infrastructure/signalr/signalrClient.test.ts` — Unit tests

**Responsibilities:**
- Manage connection lifecycle (connect, reconnect, disconnect)
- Use bearer token from server-side vault (via BFF) for authentication
- Expose `sendUpdateLocation(actorId, lat, lng)` method
- Handle connection state changes (connected/disconnected/reconnecting)
- Environment-scoped: disconnect on environment switch

### Step 3: Define location port interface (`src/features/map/domain/`)

**File to create:**
- `src/features/map/domain/locationPort.ts` — `LocationPort` interface

```ts
interface LocationPort {
  sendLocation(actorId: string, lat: number, lng: number): Promise<LocationUpdateResult>;
  getConnectionState(): ConnectionState;
  onConnectionChange(callback: (state: ConnectionState) => void): () => void;
}

type ConnectionState = "connected" | "disconnected" | "reconnecting";

type LocationUpdateResult =
  | { ok: true }
  | { ok: false; error: string; classification: FailureClassification };
```

### Step 4: Add pending location state to map store

**File to modify:** `src/shared/store/map.store.ts`

**New state:**
```ts
pendingLocation: {
  actorId: string;
  lat: number;
  lng: number;
  originalLat: number;
  originalLng: number;
} | null;

locationStatus: Record<string, "visual" | "pending" | "sent" | "accepted" | "rejected">;
```

**New actions:**
- `setPendingLocation(actorId, lat, lng)` — called on drag end
- `confirmPendingLocation()` — confirm and execute
- `cancelPendingLocation()` — revert to original position
- `setLocationStatus(actorId, status)` — update status after backend response

### Step 5: Modify map markers for location states

**File to modify:** `src/features/map/presentation/MapMarkers.tsx`

**Changes:**
- Show different visual states on markers:
  - **Visual-only** (default): standard marker appearance
  - **Pending**: pulsing/outline style awaiting confirmation
  - **Accepted**: green checkmark overlay
  - **Rejected**: red X overlay
- Show a confirmation popup when marker is in pending state
- Disable drag while location is pending

### Step 6: Add location confirmation UI

**File to create:** `src/features/map/presentation/LocationConfirmPopup.tsx`

**Responsibilities:**
- Show coordinates of the proposed location
- Show "Confirm" and "Cancel" buttons
- Show the action that will be executed (if backend-confirmed)
- Handle keyboard accessibility

### Step 7: Execute location updates through SignalR

**Flow:**
1. User drags marker → `setPendingLocation()` called
2. Confirmation popup appears
3. User confirms → `confirmPendingLocation()` called
4. SignalR `UpdateLocation(lat, lng)` sent
5. On success: `setLocationStatus(actorId, "accepted")`
6. On failure: `setLocationStatus(actorId, "rejected")`
7. Session event recorded with position data

### Step 8: Record location events in session

**Integration points:**
- Use existing `SessionRecorder.record()` with position data
- Record events for:
  - `map.placeActor` (visual placement)
  - `driver.sendLocation` (backend-confirmed update)
  - `driver.sendLocation.failed` (failed update)

### Step 9: Add i18n keys

**Files to modify:**
- `src/shared/i18n/en.ts`
- `src/shared/i18n/ar.ts`

**New keys:**
```ts
map: {
  confirmLocation: "Confirm location update",
  cancelLocation: "Cancel",
  locationPending: "Location update pending",
  locationAccepted: "Location accepted by backend",
  locationRejected: "Location rejected by backend",
  locationVisualOnly: "Visual placement (no backend update)",
  locationCoords: "Coordinates: {lat}, {lng}",
  // ...
}
```

### Step 10: Environment isolation

- Disconnect SignalR on environment switch
- Clear pending location state on environment switch
- Reset location status on environment switch

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add `@microsoft/signalr` |
| `src/infrastructure/signalr/signalrClient.ts` | Create | SignalR connection manager |
| `src/infrastructure/signalr/signalrClient.test.ts` | Create | Unit tests |
| `src/features/map/domain/locationPort.ts` | Create | Location port interface |
| `src/features/map/infrastructure/signalrLocationAdapter.ts` | Create | SignalR adapter implementing LocationPort |
| `src/shared/store/map.store.ts` | Modify | Add pending location state |
| `src/features/map/presentation/MapMarkers.tsx` | Modify | Show location states |
| `src/features/map/presentation/LocationConfirmPopup.tsx` | Create | Confirmation UI |
| `src/features/map/presentation/MapCanvas.tsx` | Modify | Integrate confirmation flow |
| `src/shared/i18n/en.ts` | Modify | Add location i18n keys |
| `src/shared/i18n/ar.ts` | Modify | Add Arabic location i18n keys |
| `src/shared/store/environment.store.ts` | Modify | Add SignalR disconnect on env switch |

## Contract Corrections & Known Limitations

- **Hub path corrected** during bring-up: initial assumption `/Bus/location/trip` was wrong —
  that path hosts `BusLocationHub`; `DriverHub.UpdateLocation` lives at `/Bus/driver`.
  The BFF token endpoint (`/api/wusool/signalr/token`) owns the hub path; the browser never sends it.
- **Silent-ignore limitation**: `DriverHub.UpdateLocation` returns normally (no error to the caller)
  when the authenticated driver has no active bus (`busId == Guid.Empty`) — the push is logged and dropped
  server-side. The framework will therefore show "accepted" even if the backend discarded the update.
  Distinguishing processed vs. ignored requires a backend ack mechanism (out of scope).

## Verification

1. `bun run lint` — passes
2. `bun run typecheck` — passes
3. `bun run test` — all unit tests pass
4. `bun run build` — builds successfully
5. Manual test: drag driver marker → confirmation popup appears → confirm → SignalR sends location → session event recorded
6. Manual test: drag driver marker → cancel → marker reverts to original position
7. Manual test: environment switch → SignalR disconnects → pending state cleared
