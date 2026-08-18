import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActorType } from "@/features/actors/domain/actor.types";
import { resetAdminAuthRefreshes } from "@/infrastructure/server/adminAuth";
import {
  getDevCredentialVault,
  resetDevCredentialVault,
} from "@/infrastructure/server/credentialVaultDev";
import {
  serverRegister,
  serverRequest,
} from "@/infrastructure/server/wusoolServerClient";
import { POST } from "./route";

vi.mock("@/infrastructure/server/wusoolServerClient", async (importActual) => {
  const actual =
    await importActual<
      typeof import("@/infrastructure/server/wusoolServerClient")
    >();
  return { ...actual, serverRegister: vi.fn(), serverRequest: vi.fn() };
});

const mockedServerRegister = vi.mocked(serverRegister);
const mockedServerRequest = vi.mocked(serverRequest);

function req(body: unknown): Request {
  return new Request("http://localhost/api/wusool/actors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const now = Date.now();

describe("POST /api/wusool/actors", () => {
  beforeEach(() => {
    resetDevCredentialVault();
    resetAdminAuthRefreshes();
    mockedServerRegister.mockReset();
    mockedServerRequest.mockReset();
  });

  it("creates a passenger without admin auth and stores the session", async () => {
    mockedServerRegister.mockResolvedValue({
      tokens: {
        accessToken: "pass-tok",
        refreshToken: "pass-refresh",
        expiresAt: now + 60_000,
      },
      userId: "u1",
    });

    const res = await POST(
      req({
        env: { envId: "local" },
        input: {
          type: ActorType.Passenger,
          email: "p@x",
          password: "secret",
          name: "Passenger",
        },
      }),
    );
    const body = (await res.json()) as { data: { id: string } };

    expect(res.status).toBe(200);
    expect(body.data.id).toBe("u1");
    expect(mockedServerRegister).toHaveBeenCalled();
    expect(mockedServerRequest).not.toHaveBeenCalled();
    const ctx = await getDevCredentialVault().resolve("u1", "local");
    expect(ctx).toMatchObject({ accessToken: "pass-tok" });
  });

  it("creates a driver using the vault admin token", async () => {
    await getDevCredentialVault().setAdminContext("local", {
      accessToken: "admin-tok",
      expiresAt: now + 60_000,
    });
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: { driverId: 42 },
      headers: {},
    });

    const res = await POST(
      req({
        env: { envId: "local" },
        input: {
          type: ActorType.Driver,
          email: "d@x",
          password: "secret",
          name: "Driver",
        },
      }),
    );
    const body = (await res.json()) as { data: { type: string; id: string } };

    expect(res.status).toBe(200);
    expect(body.data.type).toBe(ActorType.Driver);
    expect(body.data.id).toBe("42");
    expect(mockedServerRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "http://localhost:5002" }),
      "/api/v1/admin/drivers",
      expect.objectContaining({ token: "admin-tok" }),
    );
  });

  it("returns ADMIN_AUTH_REQUIRED when creating a bus without admin auth", async () => {
    const res = await POST(
      req({
        env: { envId: "local" },
        input: { type: ActorType.Bus, plateNumber: "ABC" },
      }),
    );
    const body = (await res.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("ADMIN_AUTH_REQUIRED");
    expect(mockedServerRequest).not.toHaveBeenCalled();
  });

  it("never exposes the admin token in responses", async () => {
    await getDevCredentialVault().setAdminContext("local", {
      accessToken: "super-secret-admin",
      expiresAt: now + 60_000,
    });
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: { id: 9 },
      headers: {},
    });

    const res = await POST(
      req({
        env: { envId: "local" },
        input: { type: ActorType.Bus, plateNumber: "ABC" },
      }),
    );
    const text = await res.text();

    expect(text).not.toContain("super-secret-admin");
    expect(text).not.toContain("admin-token");
  });
});
