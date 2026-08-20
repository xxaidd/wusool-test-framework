import { z } from "zod";
import { EntityKind } from "../domain/action.types";

export const entityKindSchema = z.enum([
  EntityKind.Trip,
  EntityKind.Route,
  EntityKind.Stop,
  EntityKind.Booking,
  EntityKind.Bus,
  EntityKind.Shift,
]);

export const entitySearchInputSchema = z.object({
  envId: z.string().min(1, "environment.required"),
  kind: entityKindSchema,
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export type EntitySearchInput = z.infer<typeof entitySearchInputSchema> & {
  /** Present only for auth-gated kinds; resolved to a token server-side. */
  actorId?: string;
  signal?: AbortSignal;
};

/**
 * Safe, presentation-friendly entity option. `meta` holds only non-secret
 * ancillary values (e.g. a trip's routeId for client-side filtering). No raw
 * backend snapshot.
 */
export interface EntityOption {
  value: string;
  label: string;
  meta?: Record<string, string>;
}

/** One page of matching backend entities, normalized through the contract. */
export interface EntitySearchResult {
  items: EntityOption[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  /** True when an auth-gated kind needs the actor's token to proceed. */
  needsAuth?: boolean;
}

/** Application port for backend supporting-entity search (stops, trips, ...). */
export interface EntityRepository {
  search(input: EntitySearchInput): Promise<EntitySearchResult>;
}
