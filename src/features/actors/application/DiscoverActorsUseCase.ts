import { z } from "zod";
import { AppError } from "@/shared/errors";
import type { ActorRepository, SafeActor } from "./ActorRepository";
import { actorTypeSchema } from "./ActorRepository";

export const discoverActorsInputSchema = z
  .object({
    envId: z.string().min(1, "environment.required"),
    types: actorTypeSchema.array().min(1, "actors.typesRequired"),
  })
  .extend({
    signal: z.instanceof(AbortSignal).optional(),
  });

export type DiscoverActorsInput = z.infer<typeof discoverActorsInputSchema>;

/**
 * Use case for discovering existing actors from the backend.
 * Delegates to the ActorRepository infrastructure layer.
 */
export class DiscoverActorsUseCase {
  constructor(private discoverActors: ActorRepository["discover"]) {}

  async execute(
    input: DiscoverActorsInput,
  ): Promise<
    | { status: "success"; actors: SafeActor[] }
    | { status: "failure"; error: AppError }
  > {
    try {
      const result = await this.discoverActors({
        envId: input.envId,
        types: input.types,
        signal: input.signal,
      });

      // Convert ActorRef to SafeActor (removing raw data and limiting fields)
      if (result.status === "success") {
        const safeActors: SafeActor[] = result.actors.map((actor) => ({
          id: actor.id,
          type: actor.type,
          label: actor.label,
          sublabel: actor.sublabel,
          authenticated: actor.authenticated,
          source: actor.source,
          email: actor.email ?? undefined,
          lat: actor.lat ?? undefined,
          lng: actor.lng ?? undefined,
        }));
        return { status: "success", actors: safeActors };
      }

      return result;
    } catch (err) {
      return {
        status: "failure",
        error:
          err instanceof Error
            ? new AppError("ACTOR_DISCOVERY", err.message, { status: 500 })
            : new AppError("ACTOR_DISCOVERY", "Actor discovery failed", {
                status: 500,
              }),
      };
    }
  }
}
