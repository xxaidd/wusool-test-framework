import { z } from "zod";
import type { AppError } from "@/shared/errors";
import type { ActorSource, ActorType } from "../domain/actor.types";

export const actorTypeSchema = z.enum(["passenger", "driver", "bus"]);

export const discoverActorsInputSchema = z.object({
  envId: z.string().min(1, "environment.required"),
  types: z.array(actorTypeSchema).min(1, "actors.typesRequired"),
});

export type DiscoverActorsInput = z.infer<typeof discoverActorsInputSchema> & {
  signal?: AbortSignal;
};

/**
 * Safe, presentation-friendly actor projection. Never carries tokens,
 * credentials, or raw backend snapshots; infrastructure mappers must project
 * them away (redaction policy §4).
 */
export interface SafeActor {
  id: string;
  type: ActorType;
  label: string;
  sublabel?: string;
  email?: string;
  authenticated: boolean;
  source: ActorSource;
  lat?: number;
  lng?: number;
}

export type DiscoverActorsResult =
  | { status: "success"; actors: SafeActor[] }
  | { status: "failure"; error: AppError };

export interface CreateActorInput {
  envId: string;
  type: ActorType;
  name?: string;
  email?: string;
  password?: string;
  plateNumber?: string;
  capacityNumber?: number;
  signal?: AbortSignal;
}

export type CreateActorResult =
  | { status: "success"; actor: SafeActor }
  | { status: "failure"; error: AppError };

/** Application port for discovering and creating backend actors. */
export interface ActorRepository {
  discover(input: DiscoverActorsInput): Promise<DiscoverActorsResult>;
  create(input: CreateActorInput): Promise<CreateActorResult>;
}
