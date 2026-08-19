import type { BookableTripDto } from "../schemas/entity";
import { fallbackLabel, type MappedEntityOption } from "./types";

/**
 * Map a `BookableTripDto` (flat `routeName`) to an entity option.
 * Label: `routeName · departureTime`, degrading to `Trip <id>`.
 */
export function tripMapper(input: BookableTripDto): MappedEntityOption {
  const id = String(input.id);
  const routeName = input.routeName || fallbackLabel("Trip", id);
  const label = `${routeName} · ${input.departureTime ?? id}`;
  return {
    value: id,
    label,
    raw: input as unknown as Record<string, unknown>,
  };
}
