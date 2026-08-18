import { logout } from "@/features/actors/infrastructure/authService";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BffError, bffRequest, envRef } from "@/infrastructure/bff/client";
import { useActorStore } from "@/shared/store/actor.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { useEnvironmentStore } from "@/shared/store/environment.store";
import { useSessionStore } from "@/shared/store/session.store";

export interface SwitchEnvironmentResult {
  ok: boolean;
  error?: string;
}

/**
 * Atomic environment switch. The target is validated through the BFF health
 * route before any state changes: scheme/SSRF failures (`ENVIRONMENT` /
 * `VALIDATION`) abort the switch and leave the current environment untouched.
 * A reachable-but-down backend is not an invalid environment — the switch
 * still applies and the environment store surfaces the connection error.
 *
 * On success it clears the old environment's server-side vault contexts, auth
 * display state, actor workspace, and in-memory session, records an
 * `environment.switched` boundary event, then commits the new environment
 * (which triggers a server-side health probe).
 */
export async function switchEnvironment(
  target: BackendEnvironment,
  opts: { eventLabel?: string } = {},
): Promise<SwitchEnvironmentResult> {
  const envStore = useEnvironmentStore.getState();
  const current = envStore.env;
  const changed =
    current.id !== target.id || current.baseUrl !== target.baseUrl;

  if (!changed) {
    return { ok: true };
  }

  try {
    await bffRequest<{ ok: boolean; status: number }>("/api/wusool/health", {
      env: envRef(target),
    });
  } catch (err) {
    if (
      err instanceof BffError &&
      (err.code === "ENVIRONMENT" || err.code === "VALIDATION")
    ) {
      return { ok: false, error: err.message };
    }
    // Backend unreachable: still switch; health state will show the error.
  }

  try {
    await logout(current);
  } catch {
    // Server-side vault clear is best-effort; client state is reset below.
  }

  useAuthStore.getState().clearAll();
  useActorStore.getState().clearWorkspace();
  useSessionStore.getState().finalizeForEnvironmentSwitch({
    oldLabel: current.label,
    newLabel: target.label,
    newEnvId: target.id,
    eventLabel: opts.eventLabel ?? "Switch environment",
  });

  useEnvironmentStore.setState({ adminConfigured: false });
  useEnvironmentStore.getState().setEnv(target);

  return { ok: true };
}
