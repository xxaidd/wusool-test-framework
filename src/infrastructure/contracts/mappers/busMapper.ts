import type { BusDto } from "../schemas/actor";
import { fallbackLabel } from "./types";

/**
 * Map a `BusDto` to actor fields (label + sublabel). Degrades to `Bus <id>`
 * when the plate number is missing.
 */
export function busMapper(input: BusDto): {
  id: string;
  label: string;
  sublabel?: string;
  raw?: Record<string, unknown>;
} {
  const id = String(input.id);
  const brand = [input.brand, input.model].filter(Boolean).join(" ");
  return {
    id,
    label: input.plateNumber || fallbackLabel("Bus", id),
    sublabel: brand || undefined,
    raw: input as unknown as Record<string, unknown>,
  };
}
