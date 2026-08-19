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

export interface ActionDef {
  id: string;
  labelKey: string;
  category: ActionCategory;
  actorTypes: ActorType[];
  method: HttpMethod;
  /** path template; `{id}` and other `{fieldId}` are substituted from args */
  path: string;
  requiresAuth: boolean;
  summaryKey: string;
  fields: ActionField[];
  /** map body key -> source expr ("internal.*" reads from actor.raw) */
  dynamic?: Record<string, string>;
  /**
   * Whether this action maps to a contract-verified Wusool endpoint
   * (`docs/contracts/wusool-api-v1.md`). Unverified actions are never
   * listable or executable.
   */
  verified: boolean;
  /** Reference into `src/infrastructure/contracts/endpointContract.ts`. */
  contractRef: string;
}
