import { z } from "zod";
import { ActorType } from "@/features/actors/domain/actor.types";
import type { AppError } from "@/shared/errors";
import type { ActorRepository, SafeActor } from "./ActorRepository";

export const createTestActorInputSchema = z.object({
  envId: z.string().min(1, "environment.required"),
  type: z.nativeEnum(ActorType),
  name: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().optional(),
  plateNumber: z.string().optional(),
  capacityNumber: z.number().int().positive().optional(),
});

export type CreateTestActorInput = z.infer<
  typeof createTestActorInputSchema
> & {
  signal?: AbortSignal;
};

/**
 * Use case for creating dedicated test actors through the backend.
 * Delegates to the ActorRepository infrastructure layer.
 */
export class CreateTestActorUseCase {
  constructor(private createActor: ActorRepository["create"]) {}

  async execute(
    input: CreateTestActorInput,
  ): Promise<
    | { status: "success"; actor: SafeActor }
    | { status: "failure"; error: AppError }
  > {
    try {
      const result = await this.createActor({
        envId: input.envId,
        type: input.type,
        name: input.name,
        email: input.email,
        password: input.password,
        plateNumber: input.plateNumber,
        capacityNumber: input.capacityNumber,
        signal: input.signal,
      });

      // Convert ActorRef to SafeActor (removing raw data and limiting fields)
      if (result.status === "success") {
        const safeActor: SafeActor = {
          id: result.actor.id,
          type: result.actor.type,
          label: result.actor.label,
          sublabel: result.actor.sublabel,
          authenticated: result.actor.authenticated,
          source: result.actor.source,
          email: result.actor.email ?? undefined,
          lat: result.actor.lat ?? undefined,
          lng: result.actor.lng ?? undefined,
        };
        return { status: "success", actor: safeActor };
      }

      return result;
    } catch (err) {
      if (err instanceof Error) {
        return {
          status: "failure",
          error: { message: err.message, status: 500 } as AppError,
        };
      }
      return {
        status: "failure",
        error: {
          message: "An unknown error occurred",
          status: 500,
        } as AppError,
      };
    }
  }
}
