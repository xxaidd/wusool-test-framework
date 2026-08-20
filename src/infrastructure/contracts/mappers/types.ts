import type { NameScalar } from "../schemas/entity";

/** Presentation-safe option produced by contract mappers. */
export interface MappedEntityOption {
  value: string;
  label: string;
  meta?: Record<string, string>;
  raw?: Record<string, unknown>;
}

/** Fallback label when a DTO field is missing. */
export function fallbackLabel(prefix: string, id: string | number): string {
  return `${prefix} ${id}`;
}

/**
 * Resolve a display name that may be a flat string, a localized `{en, ar}`
 * object, or missing. Prefers the `en` value; never fabricates names.
 */
export function resolveLabel(
  value: NameScalar | string | null | undefined,
  prefix: string,
  id: string | number,
): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const en = (value as { en?: string }).en;
    if (typeof en === "string" && en.trim()) return en.trim();
    const ar = (value as { ar?: string }).ar;
    if (typeof ar === "string" && ar.trim()) return ar.trim();
  }
  return fallbackLabel(prefix, id);
}
