import type { BookableTripDto } from "../schemas/entity";
import { type MappedEntityOption, resolveLabel } from "./types";

/**
 * Map a `BookableTripDto` to an entity option. The backend surfaces
 * `routeName`/`startStopName` as either flat strings or localized objects;
 * labels are resolved through {@link resolveLabel}. `meta.routeId` preserves
 * the non-secret route association for client-side filtering.
 */
export function tripMapper(input: BookableTripDto): MappedEntityOption {
  const id = String(input.id);
  const routeName = resolveLabel(input.routeName, "Trip", id);
  const label = `${routeName} · ${input.departureTime ?? id}`;
  return {
    value: id,
    label,
    meta:
      input.routeId != null ? { routeId: String(input.routeId) } : undefined,
    raw: input as unknown as Record<string, unknown>,
  };
}
