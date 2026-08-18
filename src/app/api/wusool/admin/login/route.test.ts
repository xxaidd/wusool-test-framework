import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDevCredentialVault,
  resetDevCredentialVault,
} from "@/infrastructure/server/credentialVaultDev";
import {
  ServerApiError,
  serverLogin,
} from "@/infrastructure/server/wusoolServerClient";
import { POST } from "./route";

vi.mock("@/infrastructure/server/wusoolServerClient", async (importActual) => {
  const actual =
    await importActual<
      typeof import("@/infrastructure/server/wusoolServerClient")
    >();
  return { ...actual, serverLogin: vi.fn() };
});

const mockedServerLogin = vi.mocked(serverLogin);

function req(body: unknown): Request {
  return new Request("http://localhost/api/wusool/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeJwt(exp?: number): string {
  const payload = Buffer.from(
    JSON.stringify(exp ? { sub: "admin", exp } : { sub: "admin" }),
  ).toString("base64url");
  return `h.${payload}.s`;
}

const now = Math.floor(Date.now() / 1000) + 3600;

describe("POST /api/wusool/admin/login", () => {
  beforeEach(() => {
    resetDevCredentialVault();
    mockedServerLogin.mockReset();
  });

  it("stores credential login tokens in the vault and returns only configured", async () => {
    const token = makeJwt(now);
    mockedServerLogin.mockResolvedValue({
      accessToken: token,
      refreshToken: "admin-refresh",
      tokenType: "Bearer",
      expiresAt: now * 1000,
    });

    const res = await POST(
      req({
        mode: "credentials",
        env: { envId: "local" },
        email: "admin@example.com",
        password: "admin-secret",
      }),
    );
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(JSON.parse(body)).toEqual({
      ok: true,
      data: { configured: true },
    });

    const ctx = await getDevCredentialVault().resolveAdminContext("local");
    expect(ctx).toEqual({
      accessToken: token,
      refreshToken: "admin-refresh",
      expiresAt: now * 1000,
    });

    expect(body).not.toContain(token);
    expect(body).not.toContain("admin-refresh");
    expect(body).not.toContain("admin-secret");
    expect(body).not.toContain("accessToken");
  });

  it("stores a pasted token and parses its expiry", async () => {
    const token = makeJwt(now);
    const res = await POST(
      req({ mode: "token", env: { envId: "local" }, token }),
    );

    expect(res.status).toBe(200);
    expect(mockedServerLogin).not.toHaveBeenCalled();
    const ctx = await getDevCredentialVault().resolveAdminContext("local");
    expect(ctx).toEqual({
      accessToken: token,
      expiresAt: now * 1000,
    });
  });

  it("propagates backend login failures without echoing secrets", async () => {
    mockedServerLogin.mockRejectedValue(
      new ServerApiError(401, "Invalid credentials"),
    );

    const res = await POST(
      req({
        mode: "credentials",
        env: { envId: "local" },
        email: "admin@example.com",
        password: "wrong",
      }),
    );
    const body = await res.text();

    expect(res.status).toBe(401);
    expect(JSON.parse(body)).toMatchObject({
      ok: false,
      error: { code: "BACKEND" },
    });
    expect(body).not.toContain("wrong");
    expect(
      await getDevCredentialVault().resolveAdminContext("local"),
    ).toBeNull();
  });

  it("rejects malformed bodies", async () => {
    const res = await POST(req({ env: { envId: "local" } }));
    expect(res.status).toBe(400);
    expect(mockedServerLogin).not.toHaveBeenCalled();
  });
});
