# Wusool Testing Framework — Functional Requirements

## 1. Purpose

The Wusool Testing Framework is a web-based testing and simulation environment for exercising the real Wusool backend through realistic client behavior.

The framework shall allow testers to:

- Discover and use real backend entities.
- Create dedicated test actors.
- Visualize actors and their locations on a map.
- Manually perform client actions.
- Build and execute automated workflows.
- Combine manual interaction with automation during the same live session.
- Record the complete testing session for debugging and error correlation.
- Export recorded sessions as portable session files.

The framework is intended to test real Wusool behavior rather than maintain an independent simulated copy of backend state.

---

## 2. Actor and Entity Management

### FR-01 — Supported Actors

The framework shall treat the following as first-class test actors:

- Passenger
- Driver
- Bus

Supporting Wusool entities such as trips, routes, stops, bookings, and incidents shall be treated as supporting entities rather than actors.

### FR-02 — Discover Existing Actors

The framework shall retrieve existing actors from the selected Wusool backend environment.

The tester shall be able to add discovered actors to the testing workspace.

### FR-03 — Create Dedicated Test Actors

The framework shall allow testers to create dedicated test actors through a simple creation form.

The creation form shall allow the tester to select the actor type and provide the fields required by the Wusool backend.

Dedicated test actors shall remain in the backend after the testing session ends.

### FR-04 — Actor Search

The actor panel shall provide text search for actors.

The search shall support filtering by actor type, including:

- Passenger
- Driver
- Bus

Searchable identifying properties may include backend-supported identifiers such as names, IDs, usernames, or plate numbers.

### FR-05 — Add Actors Without Authentication

A discovered or newly created actor shall be addable to the workspace without requiring authentication first.

Authentication shall only become necessary when the tester attempts an action that requires it.

### FR-06 — Just-in-Time Actor Authentication

When an action requires an unauthenticated actor, the framework shall prompt the tester to provide the actor's credentials.

The framework shall obtain and manage the actor's authentication context required to execute the action.

### FR-07 — Supporting Entity Selection

Actions that require supporting entities shall provide searchable selectors backed by the real Wusool environment.

Examples include selecting:

- Trips
- Routes
- Stops
- Other backend entities required by an action

The framework shall not rely primarily on automatic inference when the tester needs to select a specific supporting entity.

---

## 3. Map and Workspace

### FR-08 — Map and Actor Panel

The primary testing workspace shall contain:

- A map for spatial visualization and interaction.
- A side panel for discovering and managing actors.

The side panel shall be the primary source for selecting actors.

### FR-09 — Actor Placement

The tester shall be able to drag actors from the actor panel onto the map.

The effect of placement shall depend on the actor and operation being performed.

The framework shall support both visual positioning and explicit backend operations.

### FR-10 — Manual Actor Movement

The tester shall be able to manually reposition location-relevant actors on the map.

Manual positioning shall support testing location-related client behavior.

### FR-11 — Drawn Routes

The tester shall be able to draw a route/path on the map for automated actor movement.

### FR-12 — Automated Route Movement

The framework shall allow an actor to follow a drawn route automatically.

For the initial implementation, movement shall use constant movement rather than advanced GPS simulation.

The framework shall not initially require simulation of:

- GPS noise
- Acceleration/deceleration
- Heading simulation
- Traffic simulation
- Advanced GPS accuracy modeling

---

## 4. Actor Capabilities and Actions

### FR-13 — Actor Capabilities

The framework shall expose testing capabilities based on the actor type.

Initial actor categories shall include capabilities for:

- Passenger
- Driver
- Bus

The capability model shall use a hybrid approach:

- Core capabilities shall be explicitly defined by the testing framework.
- Backend-provided metadata/configuration may provide additional or changing capability information.

### FR-14 — Categorized Actions

Actions available for an actor shall be organized into logical categories.

For example:

- Trip
- Location
- Incident
- Booking

The framework shall avoid presenting all capabilities as an unstructured flat list.

### FR-15 — Action Execution

The tester shall be able to execute supported actions directly against the real Wusool backend.

An action shall represent a client-level operation rather than requiring the tester to manually construct an HTTP request.

### FR-16 — Simple Action Interface

The normal action interface shall provide a simplified form containing only the information needed to perform the selected client action.

Example:

> Passenger #42 → Book Trip → Select Trip → Execute

### FR-17 — Advanced Action Interface

The framework shall provide an advanced mode that exposes the underlying technical operation.

Advanced mode shall allow the tester to inspect relevant request information such as:

- HTTP method
- Endpoint
- Headers
- Query parameters
- Request body

The tester shall be able to inspect the complete response.

### FR-18 — Backend-Driven Action Validation

Actions shall generally remain available even when the backend may reject them.

The normal interface shall show actions that are valid for the actor and disable actions that are obviously invalid based on known state.

The framework shall allow deliberately attempting invalid operations through advanced testing functionality so that backend validation and error handling can be tested.

### FR-19 — Action Result Presentation

Action results shall have two levels of presentation.

Normal mode shall provide a simplified human-readable result, for example:

> Passenger #42 booked Trip #184.

Advanced mode shall provide technical details, including the complete request and response.

### FR-20 — Failed Actions

A backend or business error shall be recorded as a normal failed action.

The framework shall not automatically retry failed business actions.

When an action is part of an automated workflow, its configured failure behavior shall determine whether execution continues or stops.

---

## 5. Authentication

### FR-21 — Actor Credentials

The framework shall allow testers to supply credentials for individual actors through the actor interface when required.

Actor-specific authentication shall be used when an operation is intended to behave as that real client.

### FR-22 — Authentication Prompt

If an action requires authentication and the selected actor has not been authenticated, the framework shall prompt the tester for credentials.

The tester shall not be required to authenticate every actor before adding actors to the workspace.

---

## 6. Automation and Workflows

### FR-23 — Visual Workflow Builder

The framework shall provide a visual workflow builder for automated testing.

A workflow shall consist of ordered actions and control steps.

Example:

> Driver #7 → Send Location  
> Wait 5 seconds  
> Passenger #42 → Book Trip  
> Driver #7 → Report Incident

### FR-24 — Explicit Actor References

Workflow steps shall reference explicit actors.

A workflow shall be able to specify a particular actor, such as:

> Passenger #42 → Book Trip

rather than dynamically selecting an arbitrary actor at execution time.

### FR-25 — Time-Based Waits

Workflows shall support time-based waits.

Examples:

- Wait 5 seconds
- Wait 30 seconds

### FR-26 — Repeated Actions

Workflows shall support repeated actions using:

- Fixed repetition counts.
- Time-based repetition.

Example:

> Send Location 10 times.

or:

> Send Location every 5 seconds for 2 minutes.

### FR-27 — Workflow Failure Behavior

Each workflow step shall support configurable failure behavior:

- Fail and stop the workflow.
- Fail and continue the workflow.

### FR-28 — Concurrent Manual Interaction

The tester shall be able to manually interact with the live testing environment while an automated workflow is running.

### FR-29 — Manual Actions During Automation

A manual action performed while automation is running shall execute immediately and shall be recorded in the session.

The manual action shall not automatically modify the existing workflow.

### FR-30 — Automated Movement

A workflow shall be able to start automated movement for an actor along a previously defined map route.

Movement shall use the configured constant movement behavior.

---

## 7. Backend State

### FR-31 — Backend as Source of Truth

The real Wusool backend shall be treated as the authoritative source of entity state.

The framework shall not maintain an independent simulated copy of backend state for functional correctness.

### FR-32 — State Refresh

When actor or supporting-entity state is required for an operation, the framework shall retrieve the relevant state from the backend.

Local UI representations may be cached for responsiveness, but backend state shall take precedence.

---

## 8. Environment Management

### FR-33 — Environment Selection

The framework shall support switching between predefined backend environments.

Examples may include:

- Local
- Development
- Staging

### FR-34 — Custom Backend URL

The tester shall be able to configure a custom backend URL.

The same framework shall therefore be usable against different Wusool environments without changing the application itself.

### FR-35 — Environment Switching Confirmation

When switching environments, the framework shall warn the tester and require confirmation before clearing environment-specific workspace state.

### FR-36 — Environment Isolation

Actors, backend state, and other environment-specific information shall be associated with the currently selected backend environment.

### FR-37 — Backend Unavailability

If the backend becomes unavailable, the framework shall:

- Display a connection error.
- Stop actions that depend on the unavailable backend.
- Record the connection failure in the active session.

The framework shall not silently retry the failed operation.

---

## 9. Session Recording

### FR-38 — Session Recording

The framework shall continuously record the active testing session.

A session shall capture the activity performed by both manual actions and automated workflows.

### FR-39 — Session Contents

A session shall record:

- Actions
- Action results
- Requests
- Responses
- Timestamps
- Actor/entity state changes
- Workflow execution
- Errors
- Correlation information
- Correlated backend logs

### FR-40 — Manual and Automated Events

Manual and automated actions shall be represented in the same session history.

The session shall preserve the chronological relationship between them.

### FR-41 — Continuous Session Persistence

The framework shall continuously maintain the current session locally while the session is active.

The tester shall then be able to explicitly save/export the session.

### FR-42 — Session Export

The tester shall be able to export the recorded session as a session file.

The export shall contain the complete recorded session information, including request/response information and correlated backend logs.

### FR-43 — Session Files as Evidence

An exported session shall represent a record of what happened during testing.

The exported session shall be usable for:

- Bug investigation
- Error correlation
- Sharing with other developers/testers
- Reviewing a previous test session

### FR-44 — Session Replay Scope

Exported sessions shall be viewable but shall not be executable/replayable.

The session format shall represent recorded evidence rather than a portable executable test.

---

## 10. Session Investigation

### FR-45 — Timeline-First Session Viewer

The session viewer shall use a chronological timeline as its primary interface.

Example:

> 12:31:02 — Driver #7 sent location  
> 12:31:05 — Passenger #42 booked Trip #184  
> 12:31:08 — Driver #7 reported incident

### FR-46 — Human-Readable Timeline

Timeline events shall use human-readable summaries by default.

Technical HTTP details shall not be the primary presentation of the timeline.

### FR-47 — Event Details

Selecting a timeline event shall allow the tester to inspect the detailed information recorded for that event.

Detailed information may include:

- Actor
- Action
- Request
- Response
- Status code
- Timing
- Error
- Correlation information
- Related backend logs

### FR-48 — Recorded Movement Paths

The session viewer shall display static movement paths for location-based actors when location history was recorded.

The initial implementation shall not require animated historical movement playback.

---

## 11. Functional Scope and Backend Coverage

### FR-49 — Backend Capability Coverage

The framework shall provide testing actions for backend capabilities that represent supported Wusool client behavior.

The framework shall prioritize client-facing operations for:

- Passenger
- Driver
- Bus

### FR-50 — Capability Mapping

Each supported testing action shall map to one or more real Wusool backend operations.

The framework shall not simulate a successful client operation independently of the backend.

### FR-51 — Backend Evolution

The capability model shall allow new Wusool backend capabilities to be incorporated without requiring the entire framework to be redesigned.

The hybrid capability approach shall allow the framework to maintain explicit client actions while receiving additional capability information from backend metadata/configuration where appropriate.

---

## 12. Current Scope Decisions

The following decisions define the current scope of the functional requirements:

| Area | Decision |
|---|---|
| Primary model | Client/actor simulation + live system state |
| Actor sources | Existing backend actors + dedicated test actors |
| Workspace | Map + actor side panel |
| Actor placement | Behavior depends on actor/action |
| Capability discovery | Hybrid framework-defined + backend metadata |
| Action interface | Simple + advanced |
| Automation | Visual workflow builder |
| Workflow actors | Explicit actor selection |
| Workflow waits | Time-based |
| Repetition | Fixed count + time-based |
| Workflow failure | Configurable per step |
| Manual interaction during automation | Allowed |
| Manual action during automation | Executes and is recorded; does not modify workflow |
| Backend state | Backend is source of truth |
| Actors | Passenger, Driver, Bus |
| Supporting entities | Trips, routes, stops, bookings, incidents, etc. |
| Actor search | Text search + actor type |
| Supporting entity selection | Searchable backend selectors |
| Test actor creation | Simple creation form |
| Test actor cleanup | Actors remain in backend |
| Environment configuration | Predefined + custom URL |
| Environment switching | Confirmation required; environment-specific state cleared |
| Backend unavailable | Show error and stop actions |
| Movement | Manual + drawn routes |
| Automated movement | Constant movement |
| Session recording | Continuous |
| Session contents | Complete recording + backend logs |
| Session persistence | Local continuous state + explicit export |
| Session export | Complete session dump |
| Session replay | Not supported |
| Session viewer | Timeline-first |
| Timeline display | Human-readable |
| Historical movement | Static paths |

---

## 13. Deferred / Not Yet Decided

The following areas still require decisions before the functional requirements are considered complete:

- Exact list of supported Wusool endpoints/capabilities.
- Exact actor-specific action catalog.
- Exact backend log collection mechanism.
- Correlation ID generation/propagation requirements.
- Session file format and schema.
- Credential/token representation in exported sessions.
- Whether session files should contain sensitive backend data without sanitization.
- Exact workflow editing operations.
- Workflow creation, deletion, duplication, and versioning.
- Workflow start/stop controls.
- Assertions and validation beyond HTTP/action results.
- Exact map provider and map interaction capabilities.
- Exact route drawing behavior.
- Location update frequency for automated movement.
- Session naming and metadata.
- Session import/open behavior.
- Error and warning UI details.
- Framework access control and tester permissions.
- Handling of concurrent sessions/users.
- Performance limits and maximum supported actors/workflows.
- Backend API version compatibility.
