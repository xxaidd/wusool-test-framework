import type { UserTripDto } from "../schemas/entity";
import { fallbackLabel, type MappedEntityOption } from "./types";

/**
 * Map a `UserTripDto` booking (flat `boardingStopName`/`alightingStopName`) to
 * an entity option. Label: `boardingStopName → alightingStopName · status`.
 */
export function bookingMapper(input: UserTripDto): MappedEntityOption {
  const id = String(input.id);
  const boarding =
    input.boardingStopName ||
    fallbackLabel("Trip", String(input.boardingStopId ?? id));
  const alighting =
    input.alightingStopName || String(input.alightingStopId ?? id);
  const status = input.status ? ` · ${input.status}` : "";
  return {
    value: id,
    label: `${boarding} → ${alighting}${status}`,
    raw: input as unknown as Record<string, unknown>,
  };
}
