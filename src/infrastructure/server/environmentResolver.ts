import { z } from "zod";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import { envPresets } from "@/infrastructure/configuration/environments";
import { getSsrfPolicy } from "@/infrastructure/configuration/ssrfPolicy";
import { EnvironmentError, ValidationError } from "@/shared/errors";
import {
  type AssertSafeCustomUrlOptions,
  assertSafeCustomUrl,
} from "./ssrfGuard";

export interface ResolveEnvironmentInput {
  envId: string;
  baseUrl?: string;
}

export type ResolveEnvironmentOptions = AssertSafeCustomUrlOptions;

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
 * configuration; custom URLs are scheme-validated and passed through the SSRF
 * guard so user-supplied URLs cannot target private/loopback networks.
 */
export async function resolveEnvironment(
  input: ResolveEnvironmentInput,
  opts: ResolveEnvironmentOptions = {},
): Promise<BackendEnvironment> {
  if (input.baseUrl) {
    const parsed = customUrlSchema.safeParse(input.baseUrl);
    if (!parsed.success) {
      throw new ValidationError("Invalid backend URL.");
    }
    await assertSafeCustomUrl(input.baseUrl, {
      policy: opts.policy ?? getSsrfPolicy(),
      resolve: opts.resolve,
    });
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
