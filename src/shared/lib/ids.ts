let counter = 0;

/**
 * Generate a unique, prefixed identifier used for execution IDs, request IDs,
 * event IDs, and framework-side correlation IDs. Pure and framework-free.
 */
export function createId(prefix: string): string {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${counter}_${rand}`;
}
