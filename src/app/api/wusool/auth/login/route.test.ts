import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as executePOST } from "@/app/api/wusool/actions/execute/route";
import {
  getDevCredentialVault,
  resetDevCredentialVault,
} from "@/infrastructure/server/credentialVaultDev";
import {
  ServerApiError,
  serverLogin,
  serverRequest,
} from "@/infrastructure/server/wusoolServerClient";
import { POST } from "./route";

vi.mock("@/infrastructure/server/wusoolServerClient", async (importActual) => {
  const actual =
    await importActual<
      typeof import("@/infrastructure/server/wusoolServerClient")
    >();
  return { ...actual, serverLogin: vi.fn(), serverRequest: vi.fn() };
});

const mockedServerLogin = vi.mocked(serverLogin);
const mockedServerRequest = vi.mocked(serverRequest);

function req(body: unknown): Request {
  return new Request("http://localhost/api/wusool/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeJwt(exp?: number): string {
  const payload = Buffer.from(
    JSON.stringify(exp ? { sub: "7", exp } : { sub: "7" }),
  ).toString("base64url");
  return `h.${payload}.s`;
}

const loginBody = {
  env: { envId: "local" },
  actorId: "7",
  email: "passenger@example.com",
  password: "super-secret-pass",
  isDriver: false,
};

describe("POST /api/wusool/auth/login", () => {
  beforeEach(() => {
    resetDevCredentialVault();
    mockedServerLogin.mockReset();
    mockedServerRequest.mockReset();
  });

  it("stores the token in the vault and returns only authentication status", async () => {
    const token = makeJwt(1893456000);
    mockedServerLogin.mockResolvedValue({
      accessToken: token,
      refreshToken: "refresh-1",
      tokenType: "Bearer",
      expiresAt: 1893456000 * 1000,
    });

    const res = await POST(req(loginBody));
    const body = await res.text();

    expect(res.status).toBe(200);
    const json = JSON.parse(body) as { ok: boolean; data: unknown };
    expect(json).toEqual({ ok: true, data: { authenticated: true } });

    const ctx = await getDevCredentialVault().resolve("7", "local");
    expect(ctx).toEqual({
      accessToken: token,
      refreshToken: "refresh-1",
      expiresAt: 1893456000 * 1000,
    });

    expect(body).not.toContain(token);
    expect(body).not.toContain("refresh-1");
    expect(body).not.toContain("super-secret-pass");
    expect(body).not.toContain("accessToken");
  });

  it("propagates authentication failures without echoing secrets", async () => {
    mockedServerLogin.mockRejectedValue(
      new ServerApiError(401, "Invalid credentials"),
    );

    const res = await POST(req(loginBody));
    const body = await res.text();

    expect(res.status).toBe(401);
    const json = JSON.parse(body) as {
      ok: boolean;
      error: { code?: string; message?: string };
    };
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("BACKEND");
    expect(body).not.toContain("super-secret-pass");
    expect(await getDevCredentialVault().resolve("7", "local")).toBeNull();
  });

  it("fails loudly with nothing stored when the backend requires two-factor", async () => {
    mockedServerLogin.mockResolvedValue({
      accessToken: "",
      refreshToken: undefined,
      requiresTwoFactor: true,
    });

    const res = await POST(req(loginBody));
    const json = (await res.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };

    expect(res.status).toBe(401);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("AUTHENTICATION");
    expect(json.error.message.toLowerCase()).toContain("two-factor");
    expect(await getDevCredentialVault().resolve("7", "local")).toBeNull();
  });

  it("fails loudly with nothing stored when the backend returns no token", async () => {
    mockedServerLogin.mockResolvedValue({
      accessToken: "",
      refreshToken: undefined,
    });

    const res = await POST(req(loginBody));
    const json = (await res.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(res.status).toBe(401);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("AUTHENTICATION");
    expect(await getDevCredentialVault().resolve("7", "local")).toBeNull();
  });

  it("rejects malformed bodies", async () => {
    const res = await POST(req({ env: {}, actorId: "", password: "" }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(false);
    expect(mockedServerLogin).not.toHaveBeenCalled();
  });

  it("regression: a successful modal login enables the next action", async () => {
    const token = makeJwt(1893456000);
    mockedServerLogin.mockResolvedValue({
      accessToken: token,
      expiresAt: 1893456000 * 1000,
    });
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: { items: [] },
      headers: { "x-trace-id": "trace-1" },
    });

    const loginRes = await POST(req(loginBody));
    expect(loginRes.status).toBe(200);

    const executeRes = await executePOST(
      new Request("http://localhost/api/wusool/actions/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          env: { envId: "local" },
          actor: {
            id: "7",
            type: "passenger",
            label: "Passenger",
            authenticated: true,
            source: "existing",
          },
          actionId: "passenger.myBookings",
          args: {},
        }),
      }),
    );
    const executeJson = (await executeRes.json()) as {
      data: { ok: boolean };
    };

    expect(executeJson.data.ok).toBe(true);
    expect(mockedServerRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "http://localhost:5002" }),
      "/api/v1/user-trips/me",
      expect.objectContaining({ token }),
    );
  });
});
