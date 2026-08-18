import { z } from "zod";
import { ActorSource, ActorType } from "@/features/actors/domain/actor.types";

/** Browser-sent environment reference. Custom URLs are validated server-side. */
export const envInputSchema = z.object({
  envId: z.string().min(1),
  baseUrl: z.string().optional(),
});

export const actorTypeSchema = z.nativeEnum(ActorType);

/**
 * Safe actor reference sent by the browser. It deliberately excludes
 * credentials and tokens — the BFF resolves them from the server-side vault.
 */
export const actorSafeSchema = z.object({
  id: z.string().min(1),
  type: actorTypeSchema,
  label: z.string(),
  sublabel: z.string().optional(),
  source: z.nativeEnum(ActorSource),
  authenticated: z.boolean(),
});

export const argsSchema = z.record(z.string(), z.unknown()).default({});

export const positionSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const createActorInputSchema = z.object({
  type: actorTypeSchema,
  name: z.string().optional(),
  email: z.string().optional(),
  password: z.string().optional(),
  plateNumber: z.string().optional(),
  capacityNumber: z.number().optional(),
});
