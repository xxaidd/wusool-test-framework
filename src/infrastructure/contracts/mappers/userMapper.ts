import type { UserDto } from "../schemas/actor";
import { fallbackLabel } from "./types";

/**
 * Map a `UserDto` to actor fields (label + sublabel). The caller decides the
 * actor type/source; this mapper only produces display fields.
 */
export function userMapper(input: UserDto): {
  id: string;
  label: string;
  sublabel?: string;
  raw?: Record<string, unknown>;
} {
  const id = String(input.id);
  return {
    id,
    label: input.fullName || input.email || fallbackLabel("User", id),
    sublabel: input.email ?? undefined,
    raw: input as unknown as Record<string, unknown>,
  };
}
