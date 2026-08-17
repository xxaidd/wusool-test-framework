 # Wusool Testing Framework — Long-Term Implementation Roadmap

  ## 1. Goals and scope

  Build a secure, observable testing framework that exercises the real Wusool backend through Passenger, Driver, and Bus actors; supports manual actions, map
  movement, workflows, session investigation, and read-only session-file viewing.

  Explicit requirements are FR-01 through FR-51 in docs/fr/wusool_testing_framework_functional_requirements.md.

  First production-ready vertical slice: Passenger journey — discover/add a passenger, authenticate on demand, search real backend entities, reserve or
  cancel a trip, inspect the result, and export/open a sanitized session record.

  Chosen decisions:

  - Validate backend contracts against the backend repository and/or OpenAPI before extending the action catalog.
  - Use a Next.js server-side API boundary rather than browser-to-Wusool requests.
  - Redact credentials, tokens, authorization headers, and configured sensitive payload fields from sessions and exports.
  - Retrieve correlated backend logs through an authorized backend log API.
  - Support import/open of .wusool-session files as read-only evidence; never replay them.

  Deferred until their phase’s architecture gate: exact Wusool capabilities, production credential-vault implementation, map-provider credentials/usage
  policy, workflow versioning semantics, maximum performance limits, and framework user access control.

  ## 2. Current-state assessment

  ### Existing implementation

  - Next.js 16 App Router, TypeScript strict mode, Tailwind 4, Zustand, Zod, Axios, Leaflet/react-leaflet, Biome, and Vitest are installed.
  - The UI already has a map, actor workspace, environment modal, action panel, session timeline, light/dark theme, and English/Arabic translations.
  - Actor discovery/creation, a static action catalog, entity lookup, a centralized Axios client, action execution, basic map placement/following, session
    export, and unit tests exist.

  - The repository has Clean-Architecture-oriented directories, but several presentation components directly call infrastructure repositories and Zustand
    stores persist domain/security data.

  - Unit coverage exists for actor repository behavior, actions, movement helpers, and session serialization/export. There are no component, integration,
    E2E, contract, accessibility, or performance tests.

  - No CI workflow, deployment configuration, or meaningful project README exists.
  - functional-req.md duplicates part of the requirements; docs/fr/wusool_testing_framework_functional_requirements.md is the authoritative requirements
    document for this roadmap.

  - design_tokens.md is the visual-token reference.

  ### Gaps and defects to resolve early

  - The current direct browser Axios client bypasses the chosen server-side boundary.
  - Backend response handling is mostly type assertions; it does not validate actor, entity, action, or error DTOs at the infrastructure boundary.
  - Existing API endpoints and request bodies are unverified against the backend source/OpenAPI.
  - AuthPromptModal receives login tokens but does not return/store them; authentication can appear successful while subsequent actions remain
    unauthenticated.

  - Credentials/tokens can be persisted through actor and auth Zustand stores, contrary to the repository security rules.
  - Environment switching clears actors and auth but does not consistently isolate/clear sessions, routes, workflows, or cached entities.
  - The map route-drawing state is local and lacks the actual map click capture required to create a route. Dragging/movement only updates local display; it
    does not execute an explicit backend location operation.

  - Session recording is optional/manual, in-memory only, has no correlation ID/log records, no persistent storage abstraction, no redaction policy, and no
    session-file import.

  - Movement is interval-based local marker movement, not an application use case and not reusable by workflows.
  - Workflows do not exist.
  - Required libraries in AGENTS.md—Framer Motion, Radix, and Lucide React—are not installed. Do not add them merely for compliance; add only if a concrete
    UI need justifies each dependency.

  - Current quality checks cannot run in this environment because platform-specific optional packages for Vitest/Biome are missing, and Next cannot create
    its SWC cache directory. Treat dependency reproducibility as a blocking foundation issue.

  - The working tree already contains user-owned changes: package-lock.json is modified and docs/ is untracked. Preserve and review those changes; do not
    overwrite them.

  ### Architecture target

  Server Components / Client presentation
          ↓
  React hooks and focused Zustand UI stores
          ↓
  Feature application use cases
          ↓                 ↘
  Domain ports/types         Session recorder
          ↓                 ↘
  Infrastructure adapters → Next route handlers/BFF → Wusool API + log API

  - Domain: plain deterministic models, validations, workflow/movement/session rules; no React, Zustand, browser, HTTP, or Leaflet imports.
  - Application: use cases and repository interfaces; manual actions and workflow actions use the same ExecuteAction path.
  - Infrastructure: server-side Wusool client, DTO schemas/mappers, log client, credential vault, IndexedDB session storage, and Leaflet MapAdapter.
  - Presentation: components, hooks, forms, and focused Zustand state only.
  - Next route handlers are the browser-facing BFF. They authenticate the framework user, resolve actor credentials server-side, call Wusool, and return
    sanitized action/entity data.

  - Tokens never enter React state, Zustand persistence, URLs, logs, session events, or exports. The credential-vault port must have a development adapter
    and a production-approved durable adapter before multi-instance deployment.

  ## 3. Dependency order

  P0 Foundation and contracts
   ├─ P1 Security + server boundary
   ├─ P2 Core passenger vertical slice
   │   └─ P3 Sessions and investigation
   └─ P4 Map and backend movement
         └─ P5 Workflow engine and editor
  P6 Coverage expansion, scale, operations

  - P1 may begin once P0’s API contract and deployment assumptions are approved.
  - P2 and the non-UI portions of P3 can proceed in parallel after P1.
  - P4’s pure route/movement work can proceed after P0; its backend adapter depends on P1 and the location API contract.
  - P5 depends on the shared action executor from P2, durable session recording from P3, and movement use cases from P4.
  - P6 begins with CI/test infrastructure in P0 and continues throughout; capability expansion only follows contract verification.

  ———

  # Phase 0 — Establish a trustworthy foundation and backend contract

  Milestone: the repository is reproducible, the supported backend surface is documented and contract-tested, and implementation work has a stable
  architecture boundary.

  ### Task 0.1 — Repair developer tooling and establish quality gates

  - Goal: make install, test, lint, type-check, build, and local development reproducible on supported platforms.
  - Why: current unit, lint, and build commands are blocked by missing native optional dependencies/cache permissions; all later work requires reliable
    verification.

  - Scope: package-manager consistency, Node-version policy, scripts, CI baseline, and documentation. Do not alter business behavior.
  - Relevant code/files: package.json, user-owned package-lock.json, biome.json, vitest.config.mts, tsconfig.json, .gitignore, .github/.
  - Implementation approach: choose and document one supported Node LTS version and package manager; regenerate/install dependencies only after preserving/
    reconciling the existing lockfile change; add typecheck, test coverage, and CI scripts; make cache paths writable in supported environments; add a CI
    workflow that runs install, lint, typecheck, unit tests, build, and later E2E.

  - Dependencies: none.
  - Subtasks: inspect lockfile diff ownership; reproduce on clean checkout; lock platform binaries correctly; add CI status/reporting; replace template
    README with project setup and verification instructions.

  - Testing: clean-install smoke test on the target OS and CI OS.
  - Acceptance criteria: npm ci, npm run lint, npm run typecheck, npm test, and npm run build succeed in a clean supported environment; CI executes them on
    every pull request.

  - Verification: the above commands plus CI run.
  - Potential pitfalls: do not delete/recreate the user’s lockfile without approval; never commit .next, caches, credentials, or local environment values.

  ### Task 0.2 — Produce a versioned Wusool API compatibility contract

  - Goal: replace inferred hard-coded endpoint knowledge with a reviewed contract for the first passenger slice and supporting discovery/auth/log APIs.
  - Why: FR-02, FR-03, FR-07, FR-15, FR-31, FR-49–51 require real backend behavior, while the exact endpoint catalog is explicitly undecided.
  - Scope: Passenger authentication/discovery, trips/stops/bookings, environment health, errors, pagination/search, location APIs needed for the initial
    slice, correlation headers, and backend log retrieval. Driver/Bus contracts may be documented later.

  - Relevant code/files: current src/features/actions/application/actionCatalog.ts, actor/auth/entity repositories, src/infrastructure/http/
    WusoolApiClient.ts, backend repository/OpenAPI supplied by the project owner.

  - Implementation approach: inspect backend source/OpenAPI; create a versioned internal contract document and Zod DTO schemas; record endpoint, request/
    response fields, role requirements, pagination/search, error codes, correlation propagation, and API-version compatibility; mark every unsupported or
    uncertain operation unavailable rather than guessing.

  - Dependencies: read access to the Wusool backend repository or a current OpenAPI/collection.
  - Subtasks: map current catalog claims to actual backend endpoints; identify tenant/admin authorization requirements; define mocked fixtures from real
    anonymized DTOs; agree compatibility/versioning policy with backend owners.

  - Testing: schema parsing tests, mapper tests, and consumer-driven contract tests against a dedicated test/staging backend.
  - Acceptance criteria: all first-slice requests/responses are documented, schema-validated, and contract-tested; unsupported catalog entries are removed/
    flagged.

  - Verification: contract test command against approved environment and a contract-review sign-off.
  - Potential pitfalls: do not silently change backend contracts; never use production credentials/data in fixtures.

  ### Task 0.3 — Define core ports, data ownership, and redaction policy

  - Goal: establish the stable interfaces that prevent presentation code from owning backend, token, session, or map behavior.
  - Why: required by AGENTS.md Clean Architecture rules and FR-37–43.
  - Scope: domain/application interfaces only: ActorRepository, EntityRepository, ActionRepository, CredentialVault, SessionStorage, SessionRecorder,
    BackendLogRepository, and MapAdapter.

  - Relevant code/files: src/features/*/domain, application, infrastructure; current shared Zustand stores and error types.
  - Implementation approach: define plain models and discriminated outcomes; define centralized sanitization/redaction rules before events can be persisted;
    establish a request envelope containing request ID, correlation ID, environment ID, timing, sanitized request/response, and failure classification.

  - Dependencies: Task 0.2 for actual DTO fields and correlation mechanism.
  - Testing: pure unit tests for redaction, event construction, error mapping, identifiers, and DTO mappers.
  - Acceptance criteria: no application/domain interface imports React, Next, Axios, browser APIs, or Leaflet; every external input is validated; redaction
    has explicit tests.

  - Verification: rg architectural-boundary audit, typecheck, unit tests.
  - Potential pitfalls: do not encode tokens, raw credentials, or framework-specific objects in domain events.

  Agent Handoff Context — Phase 0

  - Established: Next 16/App Router, strict TypeScript, Vitest, Biome, Leaflet, Zustand, and Zod are the existing stack; current code is a prototype and
    direct browser API access must be replaced.

  - Responsibility: establish reproducible tooling and the authoritative API contract before feature growth.
  - Constraints: preserve user-owned lockfile/docs changes; backend repository is read-only; use real backend semantics only.
  - Expected outputs: green quality gates, CI baseline, contract document/schemas/fixtures, stable ports, redaction policy.
  - Definition of done: first passenger API contract is approved and executable in tests; no endpoint is expanded on inference.
  - Inspect first: AGENTS.md, docs/fr/wusool_testing_framework_functional_requirements.md, current action/actor repositories, package tooling, and the
    backend/OpenAPI.

  ———

  # Phase 1 — Security, environment isolation, and server-side integration

  Milestone: browser clients use same-origin framework endpoints; sensitive credentials are server-managed; environment failures are explicit and recorded.

  ### Task 1.1 — Implement the Next.js BFF and Wusool server client

  - Goal: move all Wusool communication behind validated Next route handlers and a centralized server-side client.
  - Why: supports the selected server-side boundary, AGENTS centralized HTTP rule, FR-15, FR-31–32, and secure handling of admin/actor credentials.
  - Scope: health, actor discovery/creation, actor authentication, supporting-entity search, action execution, and backend-log calls required for active
    phases. No client-side direct Axios calls remain.

  - Relevant code/files: replace the role of src/infrastructure/http/WusoolApiClient.ts; add App Router route handlers; feature infrastructure repositories;
    environment configuration.

  - Implementation approach: route handlers validate browser inputs with Zod, call a server-only Wusool client, normalize errors into typed safe responses,
    propagate/generate request/correlation IDs, and apply response redaction. Keep the Wusool client behind repositories used by application use cases.

  - Dependencies: Phase 0 contract and ports.
  - Testing: route-handler integration tests with mocked server client; API client tests for timeout, abort, 4xx/5xx/network failures, correlation
    propagation, and malformed DTOs.

  - Acceptance criteria: presentation components never call Wusool URL endpoints directly; all first-slice API traffic is server mediated and traceable.
  - Verification: static search for direct browser client use; integration tests; browser network inspection contains only framework same-origin routes.
  - Potential pitfalls: server-side proxying must enforce framework-user authorization and SSRF-safe environment URL validation; do not return raw upstream
    headers or secrets.

  ### Task 1.2 — Implement secure actor authentication and credential vault

  - Goal: provide just-in-time actor authentication that reliably supplies the right actor identity without browser token persistence.
  - Why: FR-05, FR-06, FR-21, FR-22 and current token-handling defect.
  - Scope: actor-auth prompt, credential submission, token refresh/expiry handling if supported by backend, actor-environment identity isolation, vault
    lifecycle.

  - Relevant code/files: actor domain/auth types, AuthPromptModal, auth.store.ts, actor store, server BFF auth route, CredentialVault port.
  - Implementation approach: remove password/token fields from persisted actor state; submit credentials over same-origin HTTPS endpoint; store resulting
    actor auth context server-side under a secure HTTP-only framework session; return only authentication status and safe actor metadata to the UI. Clear all
    contexts when an environment changes or the user explicitly signs out.

  - Dependencies: Task 1.1 and backend auth contract.
  - Testing: authentication success/failure/expired-token tests; regression test that a successful modal login enables the next action; tests proving
    storage/export/log payloads cannot contain secrets.

  - Acceptance criteria: no localStorage, Zustand persistence, event, console output, or export contains credentials/access tokens; actions ask for
    authentication only when required and retry only by user-approved continuation.

  - Verification: automated secret-scanning test fixtures, browser storage inspection, route-handler tests.
  - Potential pitfalls: define production vault durability before horizontal scaling; never persist passwords; do not turn failed business actions into
    automatic retries.

  ### Task 1.3 — Make environment switching atomic and observable

  - Goal: manage presets/custom environments safely and isolate all environment-specific state.
  - Why: FR-33–37.
  - Scope: custom URL validation, confirmation, environment-scoped workspace/auth/session/workflow/cache state, health status, unavailable-backend behavior.
  - Relevant code/files: environment domain/presentation/store, actor/session/workflow/map stores, BFF environment handling.
  - Implementation approach: model environment as explicit session context; validate allowed schemes/hosts and prevent private-network SSRF according to
    deployment policy; require confirmation when changing it; cancel active work; clear scoped workspace/auth/cache/workflow data; retain or finalize the
    prior session according to the session policy; record an environment-switch/failure event.

  - Dependencies: Tasks 1.1–1.2.
  - Testing: switching with/without workspace, invalid custom URL, aborted active request, backend unavailable, no silent retry, and cross-environment state
    leakage.

  - Acceptance criteria: environment is always visible; no actor token, actor selection, entity cache, route, workflow, or active session is erroneously
    reused across environments.

  - Verification: integration tests plus E2E environment-switch scenario.
  - Potential pitfalls: avoid exposing the admin token in the UI or persisting it in browser storage; health probing must be server-side.

  Agent Handoff Context — Phase 1

  - Established: API contracts, redaction rules, and ports from Phase 0.
  - Responsibility: enforce the server-side integration boundary and security model.
  - Key decisions: only Next BFF routes call Wusool; actor credentials/tokens are server-managed; environment changes clear all environment-specific state
    after confirmation.

  - Expected outputs: server client, BFF endpoints, credential vault, safe error/correlation envelope, environment isolation.
  - Definition of done: a browser cannot obtain a Wusool token, and a backend failure is shown and session-recorded without retry.
  - Inspect first: API contract, redaction tests, current stores/modals, and Next route-handler guidance in the installed Next documentation.

  ———

  # Phase 2 — Deliver the passenger vertical slice

  Milestone: a tester can complete a real passenger reservation/cancellation flow against a verified backend and investigate the execution.

  ### Task 2.1 — Rebuild actor discovery and workspace management around use cases

  - Goal: discover, search, create, add, select, place, and remove Passenger actors using validated real backend data.
  - Why: FR-01–05 and FR-08.
  - Scope: Passenger first; preserve the model’s ability to add Driver/Bus later. Backend creation remains only where confirmed by the contract.
  - Relevant code/files: actors feature domain/application/infrastructure/presentation, actor store, actor-panel components.
  - Implementation approach: introduce DiscoverActors, CreateTestActor, AddActorToWorkspace, and SelectActor use cases; use backend-side query/pagination for
    discovery and local filtering only for the workspace; store safe actor references and environment IDs, never raw arbitrary backend snapshots.

  - Dependencies: Phase 1 BFF and actor contract.
  - Testing: use-case tests; repository/mapping tests; component tests for filters, pagination, actor addition without authentication, duplicate prevention,
    and JIT-auth prompt.

  - Acceptance criteria: discovered/new Passenger can be added before authenticating; UI displays loading, empty, validation, and backend-unavailable states;
    actor data is scoped to its environment.

  - Verification: unit/component tests and E2E discovery/add flow.
  - Potential pitfalls: current actor IDs can collide across types/environments; use a typed stable workspace actor key.

  ### Task 2.2 — Implement contract-backed supporting-entity search

  - Goal: provide searchable, paginated backend selectors for trips and stops needed by Passenger actions.
  - Why: FR-07 and FR-32.
  - Scope: stop and trip selectors for passenger discovery/reserve/cancel; later entity kinds follow the same port.
  - Relevant code/files: actions entity repository, shared search selector, application entity-query use case, cache policy.
  - Implementation approach: debounce input; cancel superseded requests; query the BFF; validate/map backend DTOs to safe EntityOption models; keep a short
    environment-and-actor-scoped cache only for responsiveness; fetch fresh state when executing an operation.

  - Dependencies: Tasks 1.1 and 2.1; entity API contract.
  - Testing: debounce/cancellation tests, query encoding, pagination, stale environment response rejection, malformed DTO, unauthorized, and empty-result
    cases.

  - Acceptance criteria: the tester selects a specific real entity; results never cross actor/environment contexts; no “load everything” request is needed.
  - Verification: component tests and API integration tests.
  - Potential pitfalls: booking lists are actor-authenticated; do not mistakenly query them with the framework/admin identity.

  ### Task 2.3 — Replace the static action execution path with a validated action registry and executor

  - Goal: execute Passenger client actions through one typed application path with simple/advanced presentations.
  - Why: FR-13–20, FR-49–51.
  - Scope: verified Passenger actions only: minimum discovery, reservation, booking listing, cancellation; optional ratings only after contract verification.
    Preserve registry extension points for Driver/Bus/backend metadata.

  - Relevant code/files: actions domain/application/infrastructure/presentation, current actionCatalog.ts, session-recorder port.
  - Implementation approach: define action metadata separately from transport details; validate user inputs per action; refresh required backend state at
    execution; invoke ExecuteAction; return sanitized request preview/response/correlation data; display normal human summary by default and advanced
    technical detail on demand. Support explicit advanced invalid-test mode without weakening normal validation.

  - Dependencies: Tasks 1.1–1.2 and 2.2; session recorder interface from Phase 0.
  - Testing: action validation, endpoint/body/query mapping, authorization prompt, success/4xx/5xx/timeout/cancel results, business failure/no retry,
    advanced-mode redaction.

  - Acceptance criteria: every executed action has a unique execution ID, normalized outcome, safe request/response record, and human-readable result; manual
    and later workflow execution share this exact executor.

  - Verification: unit/integration tests and E2E reserve/cancel flow against dedicated test data.
  - Potential pitfalls: do not send selector fields both in path/query/body unless contract requires it; preserve a failed backend action as evidence rather
    than treating it as a UI exception.

  ### Task 2.4 — Establish the passenger release E2E scenario

  - Goal: make the chosen first vertical slice continuously demonstrable.
  - Why: validates the prototype scope in AGENTS.md.
  - Scope: connect environment, discover/add passenger, JIT authenticate, select trip/stops, execute reservation/cancellation, inspect timeline, export
    evidence.

  - Relevant code/files: E2E configuration, test fixture/provisioning scripts, Passenger UI/features.
  - Implementation approach: add Playwright only if it is the selected E2E runner; provision isolated backend actors/data through approved test APIs; run
    backend-dependent tests separately from hermetic UI tests.

  - Dependencies: Tasks 2.1–2.3 and Phase 3 basic session recording.
  - Testing: happy path, invalid action in advanced mode, auth rejection, backend unavailable, cancellation, and redaction.
  - Acceptance criteria: one stable, non-production E2E flow proves the real-backend vertical slice.
  - Verification: CI E2E job against approved isolated environment.
  - Potential pitfalls: never point destructive test creation at production; clean data only if backend test facilities explicitly permit it.

  Agent Handoff Context — Phase 2

  - Established: server BFF, secure authentication, environment isolation, and verified passenger API contract.
  - Responsibility: complete the first real customer-value flow without adding unverified endpoint coverage.
  - Key decisions: Passenger actions are registry-driven; backend is source of truth; manual actions go through the shared executor.
  - Expected outputs: actor/entity use cases, passenger action registry, simple/advanced UI, first E2E slice.
  - Definition of done: a tester can reserve/cancel using a real Passenger and inspect a recorded action safely.
  - Inspect first: verified contract, action-executor port, session recorder/redaction rules, and existing actor/action UI.

  ———

  # Phase 3 — Durable session evidence and investigation

  Milestone: all significant manual/system/workflow activity is continuously persisted, traceable, exportable, and viewable without backend replay.

  ### Task 3.1 — Implement a centralized immutable session recorder

  - Goal: create one application-level path for recording action, workflow, environment, map, and backend-health events.
  - Why: FR-38–40 and AGENTS.md traceability requirements.
  - Scope: event model, event factory, request/execution IDs, correlation IDs, sanitized request/response/error/log references, chronology, and source
    classification.

  - Relevant code/files: sessions feature domain/application; current session.store.ts; action executor; map/workflow use cases.
  - Implementation approach: replace component-level addEvent calls with a SessionRecorder dependency; generate immutable event IDs; model normal failed
    actions distinctly from infrastructure failures; record enough metadata to join user action → framework request → correlation ID → log lookup.

  - Dependencies: Phase 0 redaction/types and Phase 1 BFF correlation support.
  - Testing: event factory tests, chronological ordering under concurrent actions, redaction, cancellation, failed action, backend unavailable, and workflow/
    manual interleaving.

  - Acceptance criteria: every meaningful event is emitted once, is immutable, safe to export, and has trace metadata where available.
  - Verification: unit tests plus trace inspection from an E2E action.
  - Potential pitfalls: never use global mutable “current action”; do not pause/drop mandatory audit events merely because a timeline UI is paused.

  ### Task 3.2 — Add continuous local session storage and lifecycle

  - Goal: persist active sessions locally through a storage abstraction appropriate for large histories.
  - Why: FR-41 and AGENTS session-storage rule.
  - Scope: active-session creation/name/metadata, incremental persistence, resume/recovery behavior, retention/error handling, explicit clear/end.
  - Relevant code/files: sessions domain/application/infrastructure, session UI/store.
  - Implementation approach: add a SessionStorage port with IndexedDB browser implementation; store only sanitized evidence; batch writes safely; expose
    storage failure as a recorded/displayed structured error; associate sessions with environment metadata and format version.

  - Dependencies: Task 3.1.
  - Testing: storage adapter integration tests, large-session/batching tests, recovery after reload, quota/error behavior.
  - Acceptance criteria: an active session survives page reload within documented limits and does not rely on localStorage; storage failures are visible and
    non-silent.

  - Verification: browser integration tests and manual reload/recovery scenario.
  - Potential pitfalls: do not persist tokens, passwords, or unredacted request headers; handle IndexedDB unavailable/private-mode failure gracefully.

  ### Task 3.3 — Build session timeline, technical inspector, and correlated-log view

  - Goal: turn session evidence into a timeline-first debugging interface.
  - Why: FR-45–48.
  - Scope: human summary timeline, filters/search, event inspector, request/response metadata, correlation details, authorized backend-log retrieval, static
    movement paths.

  - Relevant code/files: sessions presentation, backend-log repository, map/session integration.
  - Implementation approach: virtualize the timeline when measurement proves it necessary; lazy-load technical/log details for selected events; provide
    explicit loading/error/permission states; plot recorded location points as static paths only.

  - Dependencies: Tasks 3.1–3.2 and backend log API contract.
  - Testing: component tests for chronology/details/redaction/log states; integration tests for correlation/time-window lookup; accessibility keyboard tests.
  - Acceptance criteria: timeline defaults to readable summaries, detailed view contains safe technical evidence and correlated logs, and historical movement
    is static.

  - Verification: component tests and E2E inspect-event/log flow.
  - Potential pitfalls: logs can contain secrets or unrelated events; enforce backend authorization, correlation filtering, redaction, and bounded query
    windows.

  ### Task 3.4 — Versioned export and read-only session import

  - Goal: export complete sanitized evidence and open it later without executing backend actions.
  - Why: FR-42–44 and selected import decision.
  - Scope: .wusool-session schema/versioning, downloader, importer/parser/migrations, read-only viewer mode.
  - Relevant code/files: session serializer/downloader, new importer and Zod schema, session viewer.
  - Implementation approach: include format version, session/environment metadata, events, static paths, and safe log excerpts/references; validate imports
    before use; reject unsupported future versions with actionable errors; allow migration only for explicitly supported old versions.

  - Dependencies: Tasks 3.1–3.3.
  - Testing: round-trip export/import, malformed/oversized file, unsupported version, missing required fields, secret-redaction regression, read-only
    enforcement.

  - Acceptance criteria: import cannot issue a backend request or mutate an active workflow; exports contain no credentials/tokens/sensitive headers.
  - Verification: unit/integration tests and browser file-import E2E scenario.
  - Potential pitfalls: “complete evidence” never overrides the mandatory security redaction policy.

  Agent Handoff Context — Phase 3

  - Established: actions produce safe normalized outcomes through the BFF; Passenger first slice exists.
  - Responsibility: make every important operation durable, explainable, exportable, and viewable offline.
  - Key decisions: IndexedDB behind SessionStorage; centralized recorder; immutable sanitized events; .wusool-session is evidence only; logs come from
    authorized correlation-ID API.

  - Expected outputs: recorder, persistence, timeline/inspector, log view, versioned exporter/importer.
  - Definition of done: a completed session can be reopened and examined with no backend calls and no secret exposure.
  - Inspect first: redaction policy, action outcome model, current session serializer/store/panel, backend log contract.

  ———

  # Phase 4 — Map abstraction and real location/movement behavior

  Milestone: the map is a replaceable visual adapter while manual and automated movement are deterministic application behavior connected to verified Wusool
  location operations.

  ### Task 4.1 — Introduce map state and a Leaflet MapAdapter

  - Goal: isolate Leaflet/react-leaflet and make route/marker/viewport state explicit and environment-scoped.
  - Why: FR-08–11 and AGENTS map architecture requirement.
  - Scope: actor markers, selection, drag/drop placement, route drawing, viewport, static historical paths. Keep Leaflet objects out of domain/application.
  - Relevant code/files: map feature domain/application/presentation; current MapCanvas; map store.
  - Implementation approach: define plain coordinates/routes and map commands/events; move route state out of local component state; implement actual click/
    tap route-point collection, undo/clear/finish behavior, drag/drop semantics, and keyboard/accessibility alternatives.

  - Dependencies: Phase 0 ports and environment scoping.
  - Testing: route reducer/domain tests; component tests for draw/edit/cancel; adapter integration tests where practical.
  - Acceptance criteria: route drawing works; no domain/application module imports Leaflet; route and placement state reset/isolate correctly on environment
    switch.

  - Verification: component/E2E map interaction tests.
  - Potential pitfalls: direct DOM drag coordinates and Leaflet object leakage; mobile/touch interaction; duplicate route points.

  ### Task 4.2 — Implement manual backend location operation

  - Goal: distinguish visual placement from a deliberate, verified location update sent to Wusool.
  - Why: FR-09–10 and FR-15.
  - Scope: only actor/location combinations confirmed by contract; visual-only positioning remains clearly labeled when no backend action exists.
  - Relevant code/files: location action definitions/use cases, action executor, map adapter/presentation, session recorder.
  - Implementation approach: map drag/drop produces a pending coordinate; a user confirms the associated location action; execute through the shared action
    executor under the required actor identity; update display only after outcome policy defined by backend source-of-truth rules.

  - Dependencies: Phase 1 BFF, location API contract, Task 4.1.
  - Testing: coordinate validation/bounds, successful/failed update, auth requirement, backend unavailable, session event/correlation.
  - Acceptance criteria: testers can tell whether a marker is visual-only, pending, accepted, or rejected by backend; all real updates are session-recorded.
  - Verification: integration/E2E location operation against dedicated actor.
  - Potential pitfalls: never imply backend state changed after a failed request; avoid high-frequency writes during drag.

  ### Task 4.3 — Build deterministic constant-speed automated movement use case

  - Goal: move an actor along a drawn route through a cancellable, testable engine that sends verified location actions at the approved frequency.
  - Why: FR-11–12 and FR-30.
  - Scope: constant movement only; no GPS noise, traffic, heading, or acceleration simulation.
  - Relevant code/files: map domain/application movement module, action executor, session recorder, workflow integration port.
  - Implementation approach: replace interval-in-component behavior with a MoveActorAlongRoute use case driven by injected clock/scheduler; interpolate by
    distance/time if required by the approved movement contract; expose start/progress/complete/cancel and per-update failure behavior; throttle UI marker
    updates separately from backend updates.

  - Dependencies: Tasks 4.1–4.2; agreed location frequency and backend rate limits.
  - Testing: fake-clock unit tests for timing/interpolation/cancel/end/failure; integration tests for location requests; performance test with representative
    route/actor counts.

  - Acceptance criteria: movement is cancellable, deterministic, backend-observable, session-recorded, and reusable by workflows.
  - Verification: unit/integration tests and manual route-follow E2E.
  - Potential pitfalls: do not place timer loops in React components; cancel immediately on environment change; do not overload the backend.

  Agent Handoff Context — Phase 4

  - Established: shared action executor, session recorder, and BFF routes are available.
  - Responsibility: make map interaction a UI adapter and movement a deterministic application use case.
  - Key decisions: Leaflet remains the map implementation behind MapAdapter; backend update and visual placement are distinct; movement is constant-speed and
    cancellable.

  - Expected outputs: route state/adapter, real location action, movement engine, recorded static paths.
  - Definition of done: a tester can draw a route, run/cancel verified actor movement, and inspect its static session path.
  - Inspect first: location API contract, map domain types/current canvas, action executor, session recorder, environment cancellation rules.

  ———

  # Phase 5 — Workflows and concurrent execution

  Milestone: testers can build and run data-driven workflows while manually interacting with the same environment.

  ### Task 5.1 — Define workflow domain model and persistence policy

  - Goal: create deterministic workflow data that explicitly references workspace actors and supports action, wait, repeat, and movement steps.
  - Why: FR-23–27 and FR-30.
  - Scope: ordered workflow definition, typed step union, explicit actor reference, fixed/time repetition, per-step failure behavior, validation. Editing/
    versioning policy is limited to the approved first implementation.

  - Relevant code/files: new features/workflows/{domain,application,infrastructure,presentation}, actor/action/map public exports.
  - Implementation approach: use discriminated unions such as action, wait, repeat, and movement; reference immutable workspace actor IDs plus environment
    ID; validate that action definitions and required inputs remain valid; store workflow definitions separately from session evidence.

  - Dependencies: Phase 2 executor and Phase 4 movement types.
  - Testing: domain validation, invalid/deleted actor/action, repeat boundaries, serializable workflow schema/migration tests.
  - Acceptance criteria: workflows contain no React, Leaflet, tokens, or raw backend objects; every step has clear stop/continue behavior.
  - Verification: unit tests and schema validation.
  - Potential pitfalls: do not make exported sessions executable workflows; avoid actor lookup by mutable display name.

  ### Task 5.2 — Implement cancellable workflow execution engine

  - Goal: execute workflow steps serially using the shared action/movement use cases and session recorder.
  - Why: FR-20, FR-25–30, concurrency and cancellation requirements in AGENTS.md.
  - Scope: start/stop/status/progress, waits, fixed/time repeats, stop-or-continue policy, cancellation, event recording. Parallel workflow execution is
    deferred until resource/concurrency policy is approved.

  - Relevant code/files: workflow application/domain, action executor, movement use case, session recorder.
  - Implementation approach: inject clock/scheduler/abort signal; give each run and action execution a unique identity; record workflow started/step started/
    completed/failed/stopped events; never block manual actions; cancel child requests/movement when the run stops or environment changes.

  - Dependencies: Task 5.1, Phase 3 recorder, Phase 4 movement.
  - Testing: fake-clock execution tests; failure continue/stop; cancellation during wait/action/movement; manual action interleaving; environment switch;
    duplicate start prevention.

  - Acceptance criteria: workflow failure obeys each step’s configured policy, manual actions execute immediately and do not alter the workflow, and all
    events share one chronological session history.

  - Verification: unit/integration tests and E2E workflow-plus-manual-action scenario.
  - Potential pitfalls: no global “currently executing action”; no retries of backend business failures; avoid mutable workflow definitions while a run is
    active.

  ### Task 5.3 — Build the visual workflow editor and run controls

  - Goal: give testers an accessible UI to create, validate, inspect, execute, and stop workflows.
  - Why: FR-23–24.
  - Scope: ordered list editor, add/edit/remove/reorder steps, explicit actor/action selectors, wait/repeat/failure controls, validation summary, run state.
    Duplication/versioning can remain a planned extension unless approved.

  - Relevant code/files: workflow presentation/store/hooks; shared UI components; i18n.
  - Implementation approach: keep editor draft state in a focused Zustand store; call application validators; reuse action forms/selectors without
    duplicating action transport logic; add Framer Motion/Radix/Lucide only if a defined interaction/accessibility gap cannot be met with existing
    primitives.

  - Dependencies: Tasks 5.1–5.2 and entity selectors.
  - Testing: component tests for editing/validation/reordering/run controls; E2E creation and execution.
  - Acceptance criteria: a tester can create the example workflow from FR-23, stop it safely, and inspect all results in the timeline.
  - Verification: component/E2E suite and accessibility scan.
  - Potential pitfalls: drag-and-drop editor interactions need keyboard equivalents; do not let manual action edits mutate active workflow definitions.

  Agent Handoff Context — Phase 5

  - Established: actions and movement share reusable use cases; sessions record immutable chronological evidence.
  - Responsibility: introduce data-driven automation without a parallel HTTP path or manual-action blocking.
  - Key decisions: explicit actor references, typed steps, injected scheduler/abort signal, per-step stop/continue, manual actions remain independent.
  - Expected outputs: workflow model/engine/editor and full automation traceability.
  - Definition of done: an interrupted or failed workflow leaves a clear, safe, chronological session trail while manual actions remain responsive.
  - Inspect first: action executor, movement engine, session recorder, actor environment identity, workflow deferred-scope list in requirements.

  ———

  # Phase 6 — Expand capabilities, harden scale, and operate safely

  Milestone: verified Driver/Bus coverage, performance evidence, operational documentation, and deployable quality controls.

  ### Task 6.1 — Incrementally add Driver and Bus capability packs

  - Goal: add supported Driver and Bus actions without redesigning the framework.
  - Why: FR-01, FR-13–15, FR-49–51.
  - Scope: one contract-approved capability pack at a time—discovery/auth first, then trip, shift, incident, bus/location operations as approved.
  - Relevant code/files: actor/action contracts, DTO schemas/mappers, action registry, entity repositories, workflow forms, translations.
  - Implementation approach: for each pack: contract review → Zod DTOs/mappers → action metadata/validation → BFF/repository → UI → recording → test fixture/
    E2E. Publish the pack only after full vertical verification.

  - Dependencies: Phases 1–5.
  - Testing: per-action unit/integration/E2E suite including authorization and backend business failure.
  - Acceptance criteria: no action is presented as supported without a verified real-backend mapping and documented actor authorization.
  - Verification: capability-pack checklist and contract tests.
  - Potential pitfalls: no bulk endpoint catalog implementation; avoid generic untyped “send arbitrary request” features.

  ### Task 6.2 — Measure and improve performance/accessibility

  - Goal: meet responsive interaction goals at agreed representative load without speculative optimization.
  - Why: AGENTS map/timeline/network performance requirements.
  - Scope: actor lists, map markers, frequent location updates, timeline rendering, entity search, workflows.
  - Relevant code/files: relevant focused stores/components; benchmark/test tooling.
  - Implementation approach: define actor/event/update-rate budgets; profile baseline; apply focused Zustand selectors, memoization, debounced search,
    virtualized lists, throttled UI updates, map clustering, and lazy code loading only where measurements justify them.

  - Dependencies: representative fixtures and completed core behavior.
  - Testing: performance benchmark/regression tests, accessibility audits, keyboard/screen-reader flows, RTL/i18n visual checks.
  - Acceptance criteria: agreed budgets are measured and documented; no whole-app re-render on location updates; core flows are keyboard accessible.
  - Verification: profiling reports, automated accessibility suite, performance CI threshold where stable.
  - Potential pitfalls: clustering can obscure explicit actor selection; preserve deterministic event ordering.

  ### Task 6.3 — Complete operations, documentation, and deployment readiness

  - Goal: make the system maintainable and safe for real test environments.
  - Why: AGENTS Definition of Done, FR-33–37, FR-39.
  - Scope: deployment guide, environment configuration, security threat model, retention policy, observability, incident/runbook, capability matrix, API
    compatibility policy.

  - Relevant code/files: README, architecture docs, CI/CD files, environment templates, operations docs.
  - Implementation approach: document setup and supported Node/package manager, BFF deployment model, secret/vault requirements, custom URL allowlist policy,
    session retention/export policy, test-environment safeguards, backend-log permissions, and rollback/incident procedures.

  - Dependencies: production deployment/vault decision and completed feature behavior.
  - Testing: deploy smoke test, configuration validation, dependency/security scan, backup/recovery test for session evidence as applicable.
  - Acceptance criteria: a new engineer can provision a non-production environment and run the verified vertical slice from documentation; security/
    operations owners approve the deployment model.

  - Verification: staging deployment checklist and runbook exercise.
  - Potential pitfalls: direct arbitrary custom URLs are a server-side SSRF risk; never advertise production readiness before authorization, vault, and log-
    access controls are approved.

  Agent Handoff Context — Phase 6

  - Established: a secure Passenger slice, session evidence, map/movement, and workflow system exist.
  - Responsibility: broaden only verified backend capability coverage and prove the system performs and operates safely.
  - Key decisions: capability packs are incremental and contract-first; optimize only after measurement; deployment must include approved secret storage and
    SSRF controls.

  - Expected outputs: Driver/Bus packs, performance/accessibility evidence, CI/CD, documentation, operations runbooks.
  - Definition of done: supported capability matrix is accurate, core quality gates are green, and staging deployment is repeatable.
  - Inspect first: capability contract matrix, performance budgets, security model, CI, and production environment policy.

  ## Cross-phase testing and verification strategy

   Level             Required coverage
  ━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Unit              Domain rules, action/workflow/movement/session logic, redaction, mappers, validation, failure classification, schedulers.
  ────────────────  ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   Integration       BFF route handlers, Wusool client/repositories, IndexedDB storage, credential-vault adapter, backend-log correlation.
  ────────────────  ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   Contract          Approved API/OpenAPI DTOs, endpoint/method/body/query/auth/version assumptions against dedicated backend environment.
  ────────────────  ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   Component         Forms, actor selection, entity search, timeline inspector, map route controls, workflow editor, accessibility and RTL behavior.
  ────────────────  ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   E2E               Passenger first slice; environment switching; unavailable backend; workflow/manual concurrency; session export/import; later Driver/Bus
                     packs.
  ────────────────  ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   Non-functional    Security/redaction regression suite, dependency audit, performance budgets, map/timeline load tests, accessibility scans.

  Standard verification for every implementation task:

  npm run lint
  npm run typecheck
  npm test
  npm run build

  Run relevant contract/integration/E2E commands in addition. Do not claim a task complete while tooling failures mask these checks; fix or explicitly track
  the toolchain blocker first.

  ## Critical path

  1. Repair reproducible tooling and CI.
  2. Obtain/validate the backend/OpenAPI contract and log/correlation contract.
  3. Define ports, redaction, and session evidence model.
  4. Build the server-side BFF, credential vault, and environment isolation.
  5. Deliver Passenger discovery → JIT authentication → entity selection → reserve/cancel through the shared executor.
  6. Add durable recording, timeline inspection, export, and read-only import.
  7. Add map/location movement and then workflow execution.
  8. Expand Driver/Bus capability packs, then finalize performance and operations readiness.

  ## Parallel work

  - After Phase 0: BFF scaffolding, session-domain/redaction unit tests, and map domain/refactoring can proceed independently.
  - After Phase 1: Passenger actor/entity work and session storage/recorder work can proceed in parallel.
  - After the shared executor exists: map adapter work, workflow domain modelling, component-test infrastructure, and documentation can proceed in parallel.
  - Driver and Bus capability packs may proceed in parallel only after each has a separate verified API contract and isolated test fixtures.

  ## Risks and technical debt

  - The exact Wusool API, authentication, correlation, log-query, CORS, rate-limit, and API-version behavior is currently unverified; the current catalog
    must not be trusted as contract.

  - The server-side BFF requires an approved framework-user authorization model and a production credential-vault implementation; in-memory storage is not
    suitable for multi-instance production.

  - Custom backend URLs create SSRF and data-exfiltration risks unless validated/allowlisted server-side.
  - “Complete session dump” conflicts with security unless redaction is enforced; the selected policy is redaction-first.
  - Browser map tiles and any future map provider need availability, attribution, rate-limit, privacy, and offline policy decisions.
  - Location API frequency and backend rate limits are unresolved; movement must remain gated until agreed.
  - Existing store persistence/security defects and direct presentation-to-infrastructure calls should be removed incrementally during Phases 1–3 rather than
    layered upon.

  - No scale limits are defined. Record representative budgets before committing to clustering, virtualization, or multi-workflow concurrency.
  - Test automation depends on isolated backend fixtures and must never create or mutate production entities.

  ## Open questions

  1. Where and how will backend repository/OpenAPI access be provided, and which API version(s) must be supported?
  2. What framework-user authentication/authorization model protects the BFF and backend-log endpoint?
  3. Which production credential-vault/session-store technology is approved, including encryption, rotation, retention, and multi-instance behavior?
  4. What exact correlation header and backend-log API/query permissions exist?
  5. Which Passenger, Driver, and Bus actions are officially supported for the first and subsequent releases?
  6. Which actor types have authoritative backend location-update operations, and what update rate/rate limit applies?
  7. Are custom backend URLs unrestricted, allowlisted, or admin-configured only?
  8. What are the workflow editing requirements beyond ordered add/edit/remove/reorder: duplication, versioning, persistence/sharing, concurrent runs, and
     ownership?

  9. What are the supported actor/workflow/session/event-volume performance targets?
  12. What deployment target and CI secrets/test-environment provisioning mechanism will be used?

  ## Recommended first steps

  1. Task 0.1: reconcile the existing package-lock.json change with its owner, document the supported Node/package-manager version, repair optional native
     dependency installation, add typecheck, and make lint/test/build green in clean CI.

  2. Task 0.2: obtain backend/OpenAPI access; create the Passenger contract matrix for auth, actor discovery, stops, trips, reserve/cancel, correlation
     headers, errors, and backend-log lookup; remove or mark all unverified current endpoints.

  3. Task 0.3: write the redaction specification and tests first, then define SessionRecorder, CredentialVault, and action outcome interfaces.
  4. Task 1.1: implement one vertical BFF route for backend health and one contract-validated Passenger discovery route before migrating the remaining client
     requests.

  5. Task 1.2: fix authentication through the secure BFF/vault path and add the regression test proving that JIT authentication enables the requested action
     without persisting a token in the browser.