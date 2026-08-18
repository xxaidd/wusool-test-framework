import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/features/actors/application/CredentialVault";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import {
  ServerApiError,
  serverRefresh,
  serverRequest,
} from "@/infrastructure/server/wusoolServerClient";
import {
  AdminAuthRequiredError,
  adminRequest,
  resetAdminAuthRefreshes,
  resolveAdminToken,
} from "./adminAuth";

vi.mock("@/infrastructure/server/wusoolServerClient", async (importActual) => {
  const actual =
    await importActual<
      typeof import("@/infrastructure/server/wusoolServerClient")
    >();
  return { ...actual, serverRefresh: vi.fn(), serverRequest: vi.fn() };
});

const mockedServerRefresh = vi.mocked(serverRefresh);
const mockedServerRequest = vi.mocked(serverRequest);

const env: BackendEnvironment = {
  id: BackendEnvId.Local,
  label: "Local",
  baseUrl: "http://localhost:5002",
};

function makeVault(initial?: AuthContext | null) {
  let ctx: AuthContext | null = initial ?? null;
  return {
    setAdminContext: vi.fn(async (_envId: string, next: AuthContext) => {
      ctx = next;
    }),
    resolveAdminContext: vi.fn(async () => ctx),
    resolve: vi.fn(async () => null),
    store: vi.fn(async () => undefined),
    setContext: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
    clearAdminContext: vi.fn(async () => undefined),
    clearForEnvironment: vi.fn(async () => undefined),
    clearAll: vi.fn(async () => undefined),
    get: () => ctx,
    set: (next: AuthContext | null) => {
      ctx = next;
    },
  };
}

const freshCtx: AuthContext = {
  accessToken: "admin-tok",
  refreshToken: "admin-refresh",
  expiresAt: Date.now() + 60_000,
};

const expiredCtx: AuthContext = {
  accessToken: "old-tok",
  refreshToken: "admin-refresh",
  expiresAt: Date.now() - 1,
};

describe("resolveAdminToken", () => {
  beforeEach(() => {
    resetAdminAuthRefreshes();
    mockedServerRefresh.mockReset();
    mockedServerRequest.mockReset();
  });

  it("returns the cached token when unexpired", async () => {
    const vault = makeVault(freshCtx);
    await expect(resolveAdminToken(vault, env)).resolves.toBe("admin-tok");
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

    await expect(resolveAdminToken(vault, env)).resolves.toBe("new-tok");
    expect(mockedServerRefresh).toHaveBeenCalledWith(env, "admin-refresh");
    expect(vault.setAdminContext).toHaveBeenCalledWith(
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

    await expect(resolveAdminToken(vault, env)).resolves.toBe("new-tok");
    expect(vault.setAdminContext).toHaveBeenCalledWith(
      "local",
      expect.objectContaining({ refreshToken: "admin-refresh" }),
    );
  });

  it("returns null when no admin context is configured", async () => {
    const vault = makeVault(null);
    await expect(resolveAdminToken(vault, env)).resolves.toBeNull();
    expect(mockedServerRefresh).not.toHaveBeenCalled();
  });

  it("returns null when expired without a refresh token", async () => {
    const vault = makeVault({ accessToken: "old", expiresAt: Date.now() - 1 });
    await expect(resolveAdminToken(vault, env)).resolves.toBeNull();
    expect(mockedServerRefresh).not.toHaveBeenCalled();
  });

  it("returns null when the refresh attempt fails", async () => {
    const vault = makeVault(expiredCtx);
    mockedServerRefresh.mockRejectedValue(new ServerApiError(401, "Expired"));

    await expect(resolveAdminToken(vault, env)).resolves.toBeNull();
  });

  it("de-duplicates concurrent refreshes per environment", async () => {
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

    const first = resolveAdminToken(vault, env);
    const second = resolveAdminToken(vault, env);
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

describe("adminRequest", () => {
  beforeEach(() => {
    resetAdminAuthRefreshes();
    mockedServerRefresh.mockReset();
    mockedServerRequest.mockReset();
  });

  it("throws AdminAuthRequiredError when the admin token is unavailable", async () => {
    const vault = makeVault(null);
    await expect(adminRequest(vault, env, "/api/v1/buses")).rejects.toThrow(
      AdminAuthRequiredError,
    );
    expect(mockedServerRequest).not.toHaveBeenCalled();
  });

  it("forwards the admin token to the backend", async () => {
    const vault = makeVault(freshCtx);
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: { items: [] },
      headers: {},
    });

    const res = await adminRequest(vault, env, "/api/v1/buses");
    expect(res.status).toBe(200);
    expect(mockedServerRequest).toHaveBeenCalledWith(
      env,
      "/api/v1/buses",
      expect.objectContaining({ token: "admin-tok" }),
    );
  });

  it("refreshes once and retries on a mid-flight 401", async () => {
    const vault = makeVault(freshCtx);
    mockedServerRequest
      .mockRejectedValueOnce(new ServerApiError(401, "Token expired"))
      .mockResolvedValueOnce({ status: 200, data: { items: [] }, headers: {} });
    mockedServerRefresh.mockResolvedValue({
      accessToken: "new-tok",
      refreshToken: "rotated-refresh",
      expiresAt: Date.now() + 60_000,
    });

    const res = await adminRequest(vault, env, "/api/v1/buses");
    expect(res.status).toBe(200);
    expect(mockedServerRefresh).toHaveBeenCalledTimes(1);
    expect(mockedServerRequest).toHaveBeenNthCalledWith(
      2,
      env,
      "/api/v1/buses",
      expect.objectContaining({ token: "new-tok" }),
    );
  });

  it("propagates 401 when there is no refresh token to use", async () => {
    const vault = makeVault({
      accessToken: "admin-tok",
      expiresAt: Date.now() + 60_000,
    });
    mockedServerRequest.mockRejectedValue(new ServerApiError(401, "Denied"));

    await expect(
      adminRequest(vault, env, "/api/v1/admin/users"),
    ).rejects.toThrow(ServerApiError);
    expect(mockedServerRefresh).not.toHaveBeenCalled();
  });

  it("propagates non-401 failures without retrying", async () => {
    const vault = makeVault(freshCtx);
    mockedServerRequest.mockRejectedValue(new ServerApiError(500, "Down"));

    await expect(adminRequest(vault, env, "/api/v1/buses")).rejects.toThrow(
      ServerApiError,
    );
    expect(mockedServerRefresh).not.toHaveBeenCalled();
  });
});
