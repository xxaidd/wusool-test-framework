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
  query: z.string().max(200, "entity.queryTooLong"),
});

export type EntitySearchInput = z.infer<typeof entitySearchInputSchema> & {
  signal?: AbortSignal;
};

/** Safe, presentation-friendly entity option. No raw backend snapshot. */
export interface EntityOption {
  value: string;
  label: string;
}

/** Application port for backend supporting-entity search (stops, trips, ...). */
export interface EntityRepository {
  search(input: EntitySearchInput): Promise<EntityOption[]>;
}
