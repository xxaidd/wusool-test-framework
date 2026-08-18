import { z } from "zod";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import { envPresets } from "@/infrastructure/configuration/environments";
import { EnvironmentError, ValidationError } from "@/shared/errors";

export interface ResolveEnvironmentInput {
  envId: string;
  baseUrl?: string;
}

const customUrlSchema = z
  .string()
  .min(1, "environment.urlRequired")
  .refine((url) => {
    try {
      const parsed = new URL(url);
      return (
        (parsed.protocol === "http:" || parsed.protocol === "https:") &&
        !parsed.username &&
        !parsed.password
      );
    } catch {
      return false;
    }
  }, "environment.urlInvalid");

/**
 * Resolve a browser-provided environment reference into a concrete
 * `BackendEnvironment`. Presets are resolved by id from the server-side
 * configuration; custom URLs are scheme-validated. SSRF allowlist policy
 * hardening is Task 1.3.
 */
export function resolveEnvironment(
  input: ResolveEnvironmentInput,
): BackendEnvironment {
  if (input.baseUrl) {
    const parsed = customUrlSchema.safeParse(input.baseUrl);
    if (!parsed.success) {
      throw new ValidationError("Invalid backend URL.");
    }
    return {
      id: BackendEnvId.Custom,
      label: "Custom",
      baseUrl: input.baseUrl,
      custom: true,
    };
  }
  const preset = envPresets.find((env) => env.id === input.envId);
  if (!preset) {
    throw new EnvironmentError(`Unknown environment "${input.envId}".`);
  }
  return preset;
}
