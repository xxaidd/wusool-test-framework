import type { DriverShiftDto } from "../schemas/entity";
import { fallbackLabel, type MappedEntityOption } from "./types";

/**
 * Map a `DriverShiftDto` to an entity option. Label:
 * `shiftDate · shiftType · status`, degrading to `Shift <id>`.
 */
export function shiftMapper(input: DriverShiftDto): MappedEntityOption {
  const id = String(input.id);
  const label = `${input.shiftDate ?? ""} · ${input.shiftType ?? ""} · ${
    input.status ?? fallbackLabel("Shift", id)
  }`;
  return {
    value: id,
    label: label.replace(/\s*·\s*/g, " · ").trim(),
    raw: input as unknown as Record<string, unknown>,
  };
}
