import type { StopDto } from "../schemas/entity";
import { fallbackLabel, type MappedEntityOption } from "./types";

/**
 * Map a `StopDto` (flat `name` string) to an entity option. Degrades to
 * `Stop <id>` when the name is missing — never fabricates localized names.
 */
export function stopMapper(input: StopDto): MappedEntityOption {
  const id = String(input.id);
  return {
    value: id,
    label: input.name || fallbackLabel("Stop", id),
    raw: input as unknown as Record<string, unknown>,
  };
}
