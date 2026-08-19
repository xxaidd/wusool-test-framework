/** Presentation-safe option produced by contract mappers. */
export interface MappedEntityOption {
  value: string;
  label: string;
  raw?: Record<string, unknown>;
}

/** Fallback label when a DTO field is missing. */
export function fallbackLabel(prefix: string, id: string | number): string {
  return `${prefix} ${id}`;
}
