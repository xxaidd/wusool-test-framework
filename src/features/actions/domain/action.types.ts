import type { ActorType } from "@/features/actors/domain/actor.types";

export enum ActionCategory {
  Trip = "trip",
  Location = "location",
  Booking = "booking",
  Incident = "incident",
  Account = "account",
  Shift = "shift",
  General = "general",
}

export enum EntityKind {
  Trip = "trip",
  Route = "route",
  Stop = "stop",
  Booking = "booking",
  Bus = "bus",
  Shift = "shift",
}

export enum ActionMode {
  Simple = "simple",
  Advanced = "advanced",
}

/** How user inputs are treated at execution. `invalid` is the advanced
 *  invalid-test mode that bypasses normal per-action validation on purpose and
 *  never weakens the normal execution path. */
export type ExecutionMode = "normal" | "invalid";

/** A translatable, human-readable action result (`{key}` + interpolation
 *  params such as actor label, trip id, booking id). */
export interface ActionSummary {
  key: string;
  params?: Record<string, string | number>;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ActionFieldOption {
  value: string;
  label: string;
}

export interface ActionField {
  id: string;
  kind:
    | "text"
    | "number"
    | "select"
    | "entity"
    | "date"
    | "password"
    | "bool"
    | "textarea";
  required?: boolean;
  /** i18n key for the field label */
  labelKey: string;
  placeholder?: string;
  options?: ActionFieldOption[];
  entity?: EntityKind;
  defaultValue?: string | number | boolean;
}

/** How a form field value maps onto the concrete transport parameter.
 *  `from` is the form field id (and registry arg key); `to` is the exact
 *  backend parameter/path/body/query name. Keeping them separate guarantees a
 *  selector is never duplicated into path + query + body unless the contract
 *  explicitly requires it. */
export interface TransportParam {
  from: string;
  to: string;
}

/** Transport detail is intentionally separated from {@link ActionMetadata}.
 *  Adding a backend capability means adding metadata + a transport mapping
 *  without touching the shared executor. */
export interface ActionTransport {
  method: HttpMethod;
  /** path template; `{name}` / `{internal.x}` placeholders are resolved at
   *  build time from args and the actor reference. */
  path: string;
  /** args → query parameters (typically entity selectors on GET). */
  queryParams?: TransportParam[];
  /** args → request body fields. Explicit so id/path selectors are not
   *  silently added to the body. */
  bodyParams?: TransportParam[];
  /** body/path target key ← source expression ("internal.*" reads
   *  actor.raw; otherwise an arg key). */
  dynamic?: Record<string, string>;
}

/** Presentation-facing action metadata, independent of how it is sent to the
 *  backend. */
export interface ActionMetadata {
  id: string;
  labelKey: string;
  category: ActionCategory;
  actorTypes: ActorType[];
  requiresAuth: boolean;
  summaryKey: string;
  fields: ActionField[];
  /** Reference into `src/infrastructure/contracts/endpointContract.ts`. */
  contractRef: string;
  /** Whether this maps to a contract-verified Wusool endpoint. Unverified
   *  actions are never listable or executable. */
  verified: boolean;
  /** Supporting entity kinds that must be refetched fresh before execution
   *  (e.g. bookings before cancellation). */
  refreshEntityKinds?: EntityKind[];
}

/** A registered client action: presentation metadata + transport mapping. */
export interface ActionDef {
  metadata: ActionMetadata;
  transport: ActionTransport;
}
