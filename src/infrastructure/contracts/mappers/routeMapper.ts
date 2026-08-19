import type { RouteResponse } from "../schemas/entity";
import { fallbackLabel, type MappedEntityOption } from "./types";

/**
 * Map a `RouteResponse` (flat `shortName`/`name`) to an entity option.
 */
export function routeMapper(input: RouteResponse): MappedEntityOption {
  const id = String(input.id);
  return {
    value: id,
    label: input.shortName || input.name || fallbackLabel("Route", id),
    raw: input as unknown as Record<string, unknown>,
  };
}
