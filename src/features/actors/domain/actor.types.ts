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
  actorId: string;
  lat: number;
  lng: number;
}

export interface CreateActorInput {
  type: ActorType;
  name?: string;
  email?: string;
  password?: string;
  plateNumber?: string;
  capacityNumber?: number;
}
