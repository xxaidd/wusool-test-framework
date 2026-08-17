<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.


backend codebase (read-only) : D:\projects\wusool-api


# AGENTS.md

## Wusool Testing Framework

This document defines the engineering rules, architecture, conventions, and development practices for the Wusool Testing Framework.

The project is a web-based testing and simulation framework for exercising the real Wusool backend with real backend actors such as passengers, drivers, and buses.

Primary goals:

1. Make realistic backend testing easy.
2. Make test sessions easy to understand and debug.
3. Keep the codebase maintainable as supported Wusool capabilities grow.
4. Maintain good performance with many actors and events.
5. Keep the framework independent from unnecessary Wusool implementation details.
6. Make the project easy for humans and AI coding agents to modify safely.

---

## 1. Technology Stack

Use:

- Next.js
- React
- TypeScript
- Zustand
- Zod 
- Axios
- Framer Motion
- Radix
- Lucide React 
- Leaflet as the map library
- A centralized HTTP/API abstraction
- Appropriate unit, integration, component, and E2E testing tools

Prefer stable, well-supported dependencies. Do not add a dependency without a clear reason.

---

## 2. Architecture

Follow Clean Architecture.

Separate:

1. Presentation
2. Application/use cases
3. Domain
4. Infrastructure

Dependency direction:

```text
Presentation
     ↓
Application
     ↓
Domain

Infrastructure
     ↓
Application / Domain
```

The Domain layer must not depend on React, Next.js, Zustand, browser APIs, HTTP clients, or map libraries.

The Application layer must not depend on React components or concrete infrastructure implementations.

Infrastructure implements interfaces required by the Application/Domain layers.

---

## 3. Recommended Structure

Use feature-oriented organization while preserving architectural boundaries:

```text
src/
├── app/
├── features/
│   ├── actors/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── presentation/
│   ├── actions/
│   ├── workflows/
│   ├── sessions/
│   ├── environments/
│   └── map/
├── shared/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── types/
│   ├── errors/
│   └── utils/
└── infrastructure/
    ├── http/
    ├── logging/
    └── configuration/
```

A feature should own its domain/application/infrastructure/presentation concerns whenever practical.

Do not create a giant global folder for unrelated business logic.

---

## 4. Domain Rules

Domain concepts include:

- Actor
- Passenger
- Driver
- Bus
- Action
- ActionResult
- Workflow
- WorkflowStep
- TestSession
- SessionEvent
- Environment
- MovementRoute

Domain code must be deterministic and easy to unit test.

Domain code must not:

- Import React.
- Import Next.js.
- Import Zustand.
- Call `fetch`.
- Access `window` or `document`.
- Access `localStorage` directly.
- Import Leaflet/MapLibre.
- Know how authentication tokens are stored.

Use plain domain data instead of framework-specific objects.

---

## 5. Application Layer

Application code contains use cases such as:

- DiscoverActors
- CreateTestActor
- AuthenticateActor
- ExecuteAction
- RecordSessionEvent
- CreateWorkflow
- ExecuteWorkflow
- MoveActorAlongRoute
- SwitchEnvironment
- ExportSession

Use cases describe what the system does, not how HTTP or UI implementation works.

Example:

```text
UI
 ↓
ExecuteActionUseCase
 ↓
ActionRepository
 ↓
Wusool API
```

---

## 6. Infrastructure

Infrastructure owns external concerns such as:

- WusoolApiClient
- ActorRepository
- ActionRepository
- SessionStorage
- BackendLogClient
- AuthenticationService
- MapAdapter

Infrastructure may depend on browser APIs, HTTP libraries, map libraries, and Next.js-specific functionality where appropriate.

Do not leak infrastructure-specific types into the Domain layer.

---

## 7. Next.js

Use the App Router.

Prefer Server Components by default.

Use `"use client"` only where required by:

- Browser APIs
- React state/event handlers
- Zustand
- Interactive maps
- Client-only libraries

Do not make the whole application a Client Component unnecessarily.

Browser-only map libraries must be isolated behind client-only boundaries.

---

## 8. Zustand

Use Zustand for client application state, not as a replacement for the domain model or server-data architecture.

Good candidates include:

- Selected actor
- Active environment
- Workspace actors
- Current session
- Workflow editor state
- Map interaction state
- UI state

Prefer focused stores such as:

```text
useActorStore
useSessionStore
useEnvironmentStore
useWorkflowStore
useMapStore
useUiStore
```

Do not create one giant global store.

Do not put every API response into Zustand.

Use selectors to minimize subscriptions:

```ts
const selectedActor = useActorStore(
  state => state.selectedActor
);
```

Do not subscribe a component to an entire store when only one value is needed.

Do not store derived state unnecessarily.

---

## 9. Server State vs Client State

Backend data is server state.

Zustand should primarily contain client state such as selections, workflow editing state, session state, and UI state.

Avoid unnecessary duplication:

```text
API response
 ↓
React state
 ↓
Zustand
 ↓
derived state
```

Prefer a simpler data flow.

---

## 10. API Communication

All Wusool API communication must pass through a centralized infrastructure/API layer.

Do not call `fetch()` directly from feature components.

Prefer:

```text
Component
   ↓
Use Case
   ↓
Repository
   ↓
WusoolApiClient
```

The API layer should centralize:

- Base URL
- Authentication
- Headers
- Serialization
- Error normalization
- Request IDs/correlation IDs
- Timeouts
- Response parsing
- API logging

Backend DTOs should be separate from domain models where appropriate:

```text
WusoolActorDto
      ↓
ActorMapper
      ↓
Actor
```

---

## 11. Environment Management

Never hardcode backend URLs in feature code.

Support:

- Preconfigured environments
- Custom backend URLs

Environment state must be explicit and visible.

Switching environments must require confirmation before clearing environment-specific workspace state.

The active environment should always be visible in the main UI.

---

## 12. Authentication and Secrets

Credentials and tokens are sensitive.

Never:

- Hardcode credentials.
- Commit credentials.
- Log passwords.
- Log access tokens.
- Log sensitive authentication headers.
- Put credentials in source code.

Authentication must be centralized.

Actors may be added without authentication. Authenticate them only when an action requires it.

The UI should not manage token refresh/storage details directly.

Session exports and logs must not accidentally expose secrets. If a requirement conflicts with security, stop and explicitly review the conflict.

---

## 13. Action Architecture

Every supported Wusool client operation should be represented as an Action.

Conceptually:

```text
Action
├── id
├── actor
├── type
├── inputs
├── execution
├── result
├── timestamp
└── correlation information
```

Manual and automated actions must use the same execution system:

```text
Manual UI ──────┐
                ├── ExecuteAction
Workflow ───────┘
```

Do not implement separate API logic for manual and workflow execution.

---

## 14. Action Results

Support two presentation levels.

### Normal

```text
✓ Driver #7 sent location
```

### Advanced

```text
POST /api/...
Status: 200

Request:
...

Response:
...
```

Both views must use the same underlying execution/result model.

Failed business/backend actions are normal failed actions. Do not silently retry them.

Workflow failure behavior should determine whether a workflow stops or continues.

---

## 15. Map Architecture

The map is an infrastructure concern.

Use an abstraction such as:

```ts
MapAdapter
```

so the application is not coupled to Leaflet or MapLibre.

The map should support:

- Actor markers
- Actor selection
- Dragging actors
- Route drawing
- Static movement paths
- Viewport management

Do not pass `L.Map`, `L.Marker`, MapLibre objects, etc. into Domain/Application code.

Use plain data:

```ts
{
  latitude: number;
  longitude: number;
}
```

---

## 16. Map Performance

Map performance is a first-class concern because location updates may be frequent.

Avoid causing the entire application to re-render for every location update.

Prefer:

- Focused Zustand selectors
- Localized subscriptions
- Memoized components where useful
- Efficient marker updates
- Clustering when actor counts justify it
- Throttled high-frequency UI updates

Measure before introducing complicated optimization.

---

## 17. Automated Movement

Movement logic belongs in the Domain/Application layer.

The map only visualizes movement.

Movement code should operate on plain route/coordinate data and should be independently testable.

Do not implement the movement engine inside a React component.

Do not use large `setInterval` loops embedded in UI components.

---

## 18. Workflow Engine

Represent workflows as data:

```text
Workflow
├── Action
├── Wait
├── Action
└── Action
```

The workflow editor belongs to Presentation.

The workflow execution engine belongs to Application.

The workflow engine must not depend on React.

Support:

- Explicit actor references
- Time-based waits
- Fixed repetition
- Time-based repetition
- Per-step failure behavior
- Manual interaction while automation runs

Manual actions during automation execute immediately and are recorded, but do not automatically modify the workflow.

---

## 19. Session Recording

Session recording is a first-class feature.

Record significant events such as:

```text
Actor added
Actor selected
Action started
Action completed
Action failed
Request sent
Response received
Workflow started
Workflow completed
Workflow failed
Actor moved
Backend unavailable
```

Use a centralized session recorder rather than scattering recording code through components.

Conceptually:

```text
ActionExecutor
      ↓
SessionRecorder
```

Session events should contain enough information to explain what happened:

```text
SessionEvent
├── id
├── timestamp
├── eventType
├── actor
├── action
├── result
├── request
├── response
├── correlationId
└── metadata
```

Prefer immutable historical events.

---

## 20. Logging and Correlation

Debuggability is a core requirement.

Preserve the relationship:

```text
User action
   ↓
Framework action
   ↓
HTTP request
   ↓
Correlation ID
   ↓
Wusool backend logs
   ↓
HTTP response
   ↓
Session event
```

Use correlation IDs where possible rather than relying only on timestamps.

Logs should answer:

- What happened?
- When?
- Which actor?
- Which action?
- Which environment?
- Which request?
- What result?
- Which correlation ID?

Never log passwords, tokens, or sensitive authentication headers.

Prefer structured logging.

---

## 21. Session Viewer

The session viewer is timeline-first.

Default events should be human-readable:

```text
12:31:02  ✓ Driver #7 sent location
12:31:05  ✓ Passenger #42 booked Trip #184
12:31:08  ✗ Driver #7 reported incident
```

Selecting an event should expose technical details:

- Actor
- Action
- Request
- Response
- Status
- Timing
- Error
- Correlation information
- Backend logs

Recorded movement should initially be shown as static paths rather than animated playback.

---

## 22. Session Storage and Export

Maintain the active session locally while it is running.

The tester explicitly exports the session.

Large sessions should not rely on localStorage by default; use an appropriate storage abstraction such as IndexedDB when required.

Keep storage behind:

```text
SessionStorage
```

The application layer should not directly call IndexedDB/localStorage.

Export through:

```text
ExportSessionUseCase
       ↓
SessionSerializer
       ↓
.wusool-session
```

Version the session format:

```json
{
  "formatVersion": 1,
  "sessionId": "...",
  "environment": "...",
  "events": []
}
```

Exported sessions are evidence/records, not executable workflows. Replay is not part of the current scope.

---

## 23. Error Handling

Use structured application errors where practical:

```text
AuthenticationError
ValidationError
BackendUnavailableError
ActionExecutionError
EnvironmentError
SessionStorageError
```

Avoid generic errors when useful information is available.

Never silently swallow errors.

Do not use empty catch blocks.

Errors must preserve useful debugging information without exposing secrets.

---

## 24. Backend Unavailability

If the Wusool backend is unavailable:

1. Show a clear connection error.
2. Stop backend-dependent actions.
3. Record the failure in the session.
4. Do not silently retry.

---

## 25. TypeScript

Use strict TypeScript.

Avoid `any`.

Use `unknown` for untrusted external data and validate/narrow it.

Prefer discriminated unions for meaningful state variants:

```ts
type ActionResult =
  | { status: "success"; data: unknown }
  | { status: "failure"; error: AppError };
```

Prefer explicit domain types over generic objects.

---

## 26. Validation

Validate external data at infrastructure/application boundaries.

Do not assume API responses are valid because TypeScript types exist.

Runtime validation is especially valuable for:

- API responses
- Imported session files
- Environment configuration
- Custom backend URLs
- Workflow/session data

---

## 27. React Components

Keep components focused.

Prefer:

```text
ActorPanel
ActorSearch
ActorList
ActorCard
ActionPanel
ActionCategory
ActionForm
SessionTimeline
SessionEvent
MapView
```

over a giant `TestingDashboard.tsx`.

Components should primarily handle:

- Rendering
- User interaction
- Presentation state
- Forms
- Calling use cases
- Displaying results

Complex business logic belongs elsewhere.

---

## 28. Custom Hooks

Hooks should encapsulate React-specific behavior.

Examples:

```text
useSelectedActor()
useSession()
useActionExecution()
useEnvironment()
useMapInteraction()
```

Hooks should not become a second Application layer.

Move complex business logic into use cases/domain services.

---

## 29. Shared Code

Only put genuinely shared code in `shared/`.

If only one feature needs something, keep it inside that feature.

Avoid giant files such as:

```text
utils.ts
helpers.ts
misc.ts
```

Prefer focused modules with descriptive names.

---

## 30. Dependencies Between Features

Do not reach into another feature's internal implementation.

Prefer public interfaces/exports:

```text
features/actors/index.ts
```

instead of deep imports into internal files.

Avoid circular dependencies.

---

## 31. Performance

Prioritize:

1. Fast initial load.
2. Responsive map interaction.
3. Responsive actor selection.
4. Efficient session timeline rendering.
5. Efficient frequent-location updates.
6. Avoiding unnecessary network requests.

Use when justified:

- Code splitting
- Lazy loading
- Memoization
- Selective Zustand subscriptions
- Virtualized lists/timelines
- Debounced search
- Throttled high-frequency updates
- Pagination

Do not optimize based only on assumptions. Measure.

---

## 32. Network Performance

Do not repeatedly fetch identical data unnecessarily.

Search requests should normally be debounced.

Large actor/entity collections should use backend pagination/search rather than loading everything into the browser.

Avoid unnecessary polling.

---

## 33. Concurrency

The framework may execute multiple actors simultaneously.

Every action must have its own identity.

Do not use global mutable variables to track the currently executing action.

Asynchronous operations must not overwrite unrelated state.

---

## 34. Cancellation

Long-running operations should support cancellation where practical:

- Workflow execution
- Automated movement
- Backend requests
- Large session exports

Use `AbortController` or an equivalent mechanism for cancellable requests.

---

## 35. Testing

Use multiple test levels.

### Unit

Test:

- Domain logic
- Action validation
- Workflow execution
- Movement calculations
- Session event creation
- Mappers
- Utilities

### Integration

Test:

- API clients
- Repositories
- Authentication
- Session persistence
- Wusool integration

### Component

Test:

- Actor selection
- Action forms
- Timeline
- Workflow editor

### E2E

Test critical flows such as:

```text
Connect environment
 ↓
Find actor
 ↓
Select actor
 ↓
Execute action
 ↓
View result
 ↓
Verify session event
```

Test behavior rather than implementation details.

---

## 36. AI Agent Rules

AI coding agents must:

1. Read `AGENTS.md` before making changes.
2. Understand the relevant architecture before editing.
3. Follow existing conventions.
4. Avoid unnecessary refactors.
5. Avoid dependencies without justification.
6. Keep changes focused and reviewable.
7. Preserve architectural boundaries.
8. Add/update tests for meaningful behavior changes.
9. Run relevant tests, type checks, and linting.
10. Never silently change backend contracts.
11. Never hardcode credentials or secrets.
12. Never weaken authentication/security just to make a test pass.
13. Explain architectural tradeoffs for cross-layer changes.
14. Prefer small, reviewable changes.

Before modifying a feature, identify:

```text
Domain
Application
Infrastructure
Presentation
Tests
```

and change the smallest appropriate layer.

---

## 37. Bug-Fixing Workflow

When fixing a bug:

1. Reproduce it.
2. Identify the layer where incorrect behavior originates.
3. Trace the data flow.
4. Inspect API request/response if applicable.
5. Inspect session/correlation data if available.
6. Fix the underlying cause.
7. Add a regression test where practical.
8. Run relevant tests/type checks/linting.
9. Check for unintended architectural changes.

Do not mask bugs with UI workarounds when the underlying cause is elsewhere.

---

## 38. Feature Development Workflow

For a new feature:

1. Understand user behavior and backend interaction.
2. Identify domain concepts and rules.
3. Define the use case.
4. Define infrastructure interfaces.
5. Implement infrastructure.
6. Implement presentation.
7. Add tests.
8. Verify observability, error handling, and performance.

---

## 39. Prototype Scope

The first prototype should prove this complete vertical slice:

```text
Real Wusool Actor
       ↓
Testing Framework
       ↓
Manual Action
       ↓
Real Wusool Backend
       ↓
Result
       ↓
Recorded Session
```

Start with a small number of real Wusool operations.

Do not implement the entire Wusool endpoint catalog before validating the core interaction.

The architecture must support adding capabilities incrementally.

---

## 40. Definition of Done

A meaningful feature is complete when it has:

- Correct behavior.
- Appropriate architectural placement.
- Type-safe implementation.
- Error handling.
- Loading states where needed.
- Session recording where applicable.
- Logging/correlation where applicable.
- Tests for meaningful behavior.
- No unnecessary performance regressions.
- No exposed secrets.
- No architectural boundary violations.
- Passing relevant lint/type/test checks.

---

## 41. Guiding Principle

The framework should make complex real-system testing feel simple without making the underlying implementation opaque.

The UI should be easy to use.

The architecture should be explicit.

Backend interactions should be observable.

Session history should explain what happened.

When something fails, a developer should be able to trace:

```text
User action
    ↓
Actor
    ↓
Application use case
    ↓
Backend request
    ↓
Correlation ID
    ↓
Wusool backend
    ↓
Backend logs
    ↓
Response
    ↓
Session event
    ↓
Timeline
```

Traceability is a core architectural requirement, not an optional debugging feature.

<!-- END:nextjs-agent-rules -->
