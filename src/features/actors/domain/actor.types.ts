export enum ActorType {
  Passenger = "passenger",
  Driver = "driver",
  Bus = "bus",
}

export enum ActorSource {
  Existing = "existing",
  Test = "test",
}

export interface Credentials {
  email: string;
  password: string;
}

export interface ActorRef {
  id: string;
  type: ActorType;
  label: string;
  sublabel?: string;
  authenticated: boolean;
  lat?: number;
  lng?: number;
  source: ActorSource;
  /** raw backend object snapshot (helps build action bodies). */
  raw?: Record<string, unknown>;
}

export interface PlacedActor {
  /** Stable workspace key (see {@link actorWorkspaceKeyOf}). */
  actorKey: string;
  lat: number;
  lng: number;
}

/** Stable workspace identity that disambiguates actors whose raw backend `id`
 *  can collide across types (and, because environment switches clear the
 *  workspace, across environments). Selection, placement, movement, and
 *  duplicate detection are all keyed by this, never by the raw `id`. */
export function actorWorkspaceKey(type: ActorType, id: string): string {
  return `${type}:${id}`;
}

export function actorWorkspaceKeyOf(a: Pick<ActorRef, "type" | "id">): string {
  return actorWorkspaceKey(a.type, a.id);
}

export interface CreateActorInput {
  type: ActorType;
  name?: string;
  email?: string;
  password?: string;
  plateNumber?: string;
  capacityNumber?: number;
}
