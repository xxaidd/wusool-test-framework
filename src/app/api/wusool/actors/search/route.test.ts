import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActorType } from "@/features/actors/domain/actor.types";
import { resetAdminAuthRefreshes } from "@/infrastructure/server/adminAuth";
import {
  getDevCredentialVault,
  resetDevCredentialVault,
} from "@/infrastructure/server/credentialVaultDev";
import {
  serverRefresh,
  serverRequest,
} from "@/infrastructure/server/wusoolServerClient";
import { POST } from "./route";

vi.mock("@/infrastructure/server/wusoolServerClient", async (importActual) => {
  const actual =
    await importActual<
      typeof import("@/infrastructure/server/wusoolServerClient")
    >();
  return { ...actual, serverRequest: vi.fn(), serverRefresh: vi.fn() };
});

const mockedServerRequest = vi.mocked(serverRequest);
const mockedServerRefresh = vi.mocked(serverRefresh);

function req(body: unknown): Request {
  return new Request("http://localhost/api/wusool/actors/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const searchBody = {
  env: { envId: "local" },
  types: [ActorType.Passenger, ActorType.Driver, ActorType.Bus],
};

const now = Date.now();

describe("POST /api/wusool/actors/search", () => {
  beforeEach(() => {
    resetDevCredentialVault();
    resetAdminAuthRefreshes();
    mockedServerRequest.mockReset();
    mockedServerRefresh.mockReset();
  });

  it("discovers buses and users using the vault admin token", async () => {
    await getDevCredentialVault().setAdminContext("local", {
      accessToken: "admin-tok",
      expiresAt: now + 60_000,
    });
    mockedServerRequest.mockImplementation(async (_env, path: string) => {
      if (path === "/api/v1/buses")
        return {
          status: 200,
          data: { items: [{ id: 1, plateNumber: "ABC" }] },
          headers: {},
        };
      if (path === "/api/v1/admin/users")
        return {
          status: 200,
          data: {
            items: [
              { id: 7, email: "p@x", roles: ["Passenger"] },
              { id: 8, email: "d@x", roles: ["Driver"] },
            ],
          },
          headers: {},
        };
      throw new Error(`Unexpected path ${path}`);
    });

    const res = await POST(req(searchBody));
    const body = (await res.json()) as { data: unknown[] };

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(3);
    expect(mockedServerRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "http://localhost:5002" }),
      "/api/v1/buses",
      expect.objectContaining({ token: "admin-tok" }),
    );
    expect(mockedServerRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "http://localhost:5002" }),
      "/api/v1/admin/users",
      expect.objectContaining({ token: "admin-tok" }),
    );
    expect(mockedServerRefresh).not.toHaveBeenCalled();
  });

  it("silently refreshes the admin token before discovering when expired", async () => {
    await getDevCredentialVault().setAdminContext("local", {
      accessToken: "old-tok",
      refreshToken: "admin-refresh",
      expiresAt: now - 1,
    });
    mockedServerRefresh.mockResolvedValue({
      accessToken: "new-tok",
      refreshToken: "rotated-refresh",
      expiresAt: now + 60_000,
    });
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: { items: [] },
      headers: {},
    });

    const res = await POST(req(searchBody));

    expect(res.status).toBe(200);
    expect(mockedServerRefresh).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "http://localhost:5002" }),
      "admin-refresh",
    );
    // Every backend call uses the refreshed token.
    expect(mockedServerRequest).toHaveBeenCalledTimes(2);
    expect(mockedServerRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "http://localhost:5002" }),
      expect.any(String),
      expect.objectContaining({ token: "new-tok" }),
    );
  });

  it("returns ADMIN_AUTH_REQUIRED when no admin context is configured", async () => {
    const res = await POST(req(searchBody));
    const body = (await res.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(res.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("ADMIN_AUTH_REQUIRED");
    expect(mockedServerRequest).not.toHaveBeenCalled();
  });

  it("returns ADMIN_AUTH_REQUIRED when the token cannot be refreshed", async () => {
    await getDevCredentialVault().setAdminContext("local", {
      accessToken: "old-tok",
      refreshToken: "admin-refresh",
      expiresAt: now - 1,
    });
    mockedServerRefresh.mockRejectedValue(new Error("refresh failed"));

    const res = await POST(req(searchBody));
    const body = (await res.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("ADMIN_AUTH_REQUIRED");
    expect(mockedServerRequest).not.toHaveBeenCalled();
  });

  it("never exposes the admin token in the response", async () => {
    await getDevCredentialVault().setAdminContext("local", {
      accessToken: "super-secret-admin",
      expiresAt: now + 60_000,
    });
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: { items: [{ id: 1, plateNumber: "ABC" }] },
      headers: {},
    });

    const res = await POST(req(searchBody));
    const text = await res.text();

    expect(text).not.toContain("super-secret-admin");
  });
});
