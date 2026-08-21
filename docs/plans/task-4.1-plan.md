# Task 4.1 — Introduce map state and a Leaflet MapAdapter

## Goal
Isolate Leaflet/react-leaflet and make route/marker/viewport state explicit and
environment-scoped, fixing the broken route drawing feature and establishing a
dedicated `useMapStore` following AGENTS.md architecture rules.

## Why
FR-08–11 and AGENTS.md map architecture requirement. Current defects:

- MapCanvas is a 352-line monolith with local `useState` for route, drawing,
  following, speed, and history. No dedicated `useMapStore` exists.
- Route drawing is broken: toolbar toggles `drawing` mode but there is no click
  handler on `MapContainer` to add points to the route.
- No viewport management: hardcoded center/zoom, no programmatic camera control.
- `MapAdapter` interface defined but unimplemented; no infrastructure layer exists.
- Unused `drawingRoute` field in actor store (MapCanvas manages its own state).

## Architecture
```
MapCanvas (presentation)
  ├── MapDropZone — HTML5 drag-and-drop from ActorPanel
  ├── MapViewportSync — syncs useMapStore viewport ↔ Leaflet map
  ├── MapMarkers — renders placed actor markers from store
  ├── MapRoute — draws polyline + handles map clicks for route points
  ├── MapToolbar — drawing/follow/history controls
  └── SpeedControl — speed input

useMapStore (shared/store) — all map UI state in one focused store
LeafletMapAdapter (infrastructure) — concrete MapAdapter implementation
```

## Changes

### New files
- `src/shared/store/map.store.ts` — focused Zustand store for map UI state
- `src/shared/store/map.store.test.ts` — 16 unit tests
- `src/features/map/infrastructure/LeafletMapAdapter.ts` — concrete MapAdapter
- `src/features/map/presentation/MapMarkers.tsx` — actor marker rendering
- `src/features/map/presentation/MapRoute.tsx` — route polyline + click handler
- `src/features/map/presentation/MapToolbar.tsx` — drawing/follow/history controls
- `src/features/map/presentation/MapViewportSync.tsx` — viewport sync
- `src/features/map/presentation/MapDropZone.tsx` — drag-and-drop handler

### Modified files
- `src/features/map/domain/map.types.ts` — added `MapCommand` type
- `src/features/map/presentation/MapCanvas.tsx` — refactored to use sub-components
- `src/features/map/index.ts` — updated exports
- `src/shared/store/actor.store.ts` — removed `drawingRoute`/`setDrawingRoute`
- `src/shared/store/actor.store.test.ts` — removed `drawingRoute` references
- `src/shared/store/auth-security.test.ts` — removed `drawingRoute` references
- `src/shared/store/environmentSwitch.test.ts` — removed `drawingRoute` references

## Acceptance criteria
- Route drawing works: click map to add points, finish/cancel via toolbar
- No domain/application module imports Leaflet
- Route and placement state reset on environment switch
- `bun run typecheck`, `bun run test`, `bun run build` all pass
- Architecture boundary test passes

## Verification
- `bun run typecheck` — passes
- `bun run test` — 393/393 pass (16 new map store tests)
- `bun run build` — succeeds
- Architecture boundary test — passes
