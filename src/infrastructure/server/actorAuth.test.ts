import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/features/actors/application/CredentialVault";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import {
  ServerApiError,
  serverRefresh,
} from "@/infrastructure/server/wusoolServerClient";
import { resetActorAuthRefreshes, resolveActorToken } from "./actorAuth";

vi.mock("@/infrastructure/server/wusoolServerClient", async (importActual) => {
  const actual =
    await importActual<
      typeof import("@/infrastructure/server/wusoolServerClient")
    >();
  return { ...actual, serverRefresh: vi.fn() };
});

const mockedServerRefresh = vi.mocked(serverRefresh);

const env: BackendEnvironment = {
  id: BackendEnvId.Local,
  label: "Local",
  baseUrl: "http://localhost:5002",
};

function makeVault(initial?: AuthContext | null) {
  let ctx: AuthContext | null = initial ?? null;
  return {
    setContext: vi.fn(
      async (_actorId: string, _envId: string, next: AuthContext) => {
        ctx = next;
      },
    ),
    resolve: vi.fn(async () => ctx),
    setAdminContext: vi.fn(async () => undefined),
    resolveAdminContext: vi.fn(async () => null),
    clearAdminContext: vi.fn(async () => undefined),
    store: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
    clearForEnvironment: vi.fn(async () => undefined),
    clearAll: vi.fn(async () => undefined),
    get: () => ctx,
    set: (next: AuthContext | null) => {
      ctx = next;
    },
  };
}

const freshCtx: AuthContext = {
  accessToken: "actor-tok",
  refreshToken: "actor-refresh",
  expiresAt: Date.now() + 60_000,
};

const expiredCtx: AuthContext = {
  accessToken: "old-tok",
  refreshToken: "actor-refresh",
  expiresAt: Date.now() - 1,
};

describe("resolveActorToken", () => {
  beforeEach(() => {
    resetActorAuthRefreshes();
    mockedServerRefresh.mockReset();
  });

  it("returns the cached token when unexpired", async () => {
    const vault = makeVault(freshCtx);
    await expect(resolveActorToken(vault, env, "7")).resolves.toBe("actor-tok");
    expect(mockedServerRefresh).not.toHaveBeenCalled();
  });

  it("uses an opaque token with unknown expiry as-is", async () => {
    const vault = makeVault({ accessToken: "opaque-tok" });
    await expect(resolveActorToken(vault, env, "7")).resolves.toBe(
      "opaque-tok",
    );
    expect(mockedServerRefresh).not.toHaveBeenCalled();
  });

  it("silently refreshes when expired and persists the new context", async () => {
    const vault = makeVault(expiredCtx);
    mockedServerRefresh.mockResolvedValue({
      accessToken: "new-tok",
      refreshToken: "rotated-refresh",
      tokenType: "Bearer",
      expiresAt: Date.now() + 60_000,
    });

    await expect(resolveActorToken(vault, env, "7")).resolves.toBe("new-tok");
    expect(mockedServerRefresh).toHaveBeenCalledWith(env, "actor-refresh");
    expect(vault.setContext).toHaveBeenCalledWith(
      "7",
      "local",
      expect.objectContaining({
        accessToken: "new-tok",
        refreshToken: "rotated-refresh",
      }),
    );
  });

  it("keeps the old refresh token when the backend does not rotate", async () => {
    const vault = makeVault(expiredCtx);
    mockedServerRefresh.mockResolvedValue({
      accessToken: "new-tok",
      expiresAt: Date.now() + 60_000,
    });

    await expect(resolveActorToken(vault, env, "7")).resolves.toBe("new-tok");
    expect(vault.setContext).toHaveBeenCalledWith(
      "7",
      "local",
      expect.objectContaining({ refreshToken: "actor-refresh" }),
    );
  });

  it("returns null when no context is stored", async () => {
    const vault = makeVault(null);
    await expect(resolveActorToken(vault, env, "7")).resolves.toBeNull();
    expect(mockedServerRefresh).not.toHaveBeenCalled();
  });

  it("returns null when expired without a refresh token", async () => {
    const vault = makeVault({ accessToken: "old", expiresAt: Date.now() - 1 });
    await expect(resolveActorToken(vault, env, "7")).resolves.toBeNull();
    expect(mockedServerRefresh).not.toHaveBeenCalled();
  });

  it("returns null when the refresh attempt fails", async () => {
    const vault = makeVault(expiredCtx);
    mockedServerRefresh.mockRejectedValue(new ServerApiError(401, "Expired"));

    await expect(resolveActorToken(vault, env, "7")).resolves.toBeNull();
  });

  it("de-duplicates concurrent refreshes per actor and environment", async () => {
    const vault = makeVault(expiredCtx);
    let resolveFn: () => void = () => undefined;
    mockedServerRefresh.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFn = () =>
            resolve({
              accessToken: "new-tok",
              expiresAt: Date.now() + 60_000,
            });
        }),
    );

    const first = resolveActorToken(vault, env, "7");
    const second = resolveActorToken(vault, env, "7");
    await Promise.resolve();
    await Promise.resolve();
    resolveFn();
    await expect(Promise.all([first, second])).resolves.toEqual([
      "new-tok",
      "new-tok",
    ]);
    expect(mockedServerRefresh).toHaveBeenCalledTimes(1);
  });
});
