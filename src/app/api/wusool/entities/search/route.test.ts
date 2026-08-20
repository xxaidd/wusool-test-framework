import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDevCredentialVault,
  resetDevCredentialVault,
} from "@/infrastructure/server/credentialVaultDev";
import { serverRequest } from "@/infrastructure/server/wusoolServerClient";
import { POST } from "./route";

vi.mock("@/infrastructure/server/wusoolServerClient", async (importActual) => {
  const actual =
    await importActual<
      typeof import("@/infrastructure/server/wusoolServerClient")
    >();
  return { ...actual, serverRequest: vi.fn() };
});

const mockedServerRequest = vi.mocked(serverRequest);

function req(body: unknown): Request {
  return new Request("http://localhost/api/wusool/entities/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const base = { env: { envId: "local" }, kind: "stop" };

describe("POST /api/wusool/entities/search", () => {
  beforeEach(() => {
    resetDevCredentialVault();
    mockedServerRequest.mockReset();
  });

  it("returns a paged, mapped result for a public kind without a token", async () => {
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: {
        items: [
          { id: 1, name: "Central Station" },
          { id: 2, name: "King Fahd Rd" },
        ],
        pagination: {
          currentPage: 1,
          pageSize: 25,
          totalCount: 2,
          totalPages: 1,
          hasNextPage: false,
        },
      },
      headers: {},
    });

    const res = await POST(req({ ...base, pageSize: 25 }));
    const body = (await res.json()) as {
      data: {
        items: { value: string; label: string; meta?: unknown }[];
        page: number;
        total: number;
        hasMore: boolean;
      };
    };

    expect(res.status).toBe(200);
    expect(body.data.items.map((i) => i.label)).toEqual([
      "Central Station",
      "King Fahd Rd",
    ]);
    expect(body.data.page).toBe(1);
    expect(body.data.total).toBe(2);
    expect(body.data.hasMore).toBe(false);
    // Public kind: no token header sent.
    expect(mockedServerRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "http://localhost:5002" }),
      "/api/v1/stops",
      expect.objectContaining({ token: undefined }),
    );
  });

  it("skips malformed DTO items instead of guessing", async () => {
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: { items: [{ id: 3, name: "Valid" }, { name: "MissingId" }] },
      headers: {},
    });

    const res = await POST(req(base));
    const body = (await res.json()) as { data: { items: unknown[] } };

    expect(body.data.items).toEqual([
      { value: "3", label: "Valid", meta: undefined },
    ]);
  });

  it("returns an empty result for an empty page", async () => {
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: {
        items: [],
        pagination: { currentPage: 1, pageSize: 25, totalCount: 0 },
      },
      headers: {},
    });

    const res = await POST(req(base));
    const body = (await res.json()) as {
      data: { items: unknown[]; hasMore: boolean; total: number };
    };

    expect(body.data.items).toEqual([]);
    expect(body.data.hasMore).toBe(false);
    expect(body.data.total).toBe(0);
  });

  it("surfaces hasMore and caps requested page size at 50", async () => {
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: {
        items: [],
        pagination: {
          currentPage: 1,
          pageSize: 50,
          totalCount: 120,
          hasNextPage: true,
        },
      },
      headers: {},
    });

    const res = await POST(req({ ...base, pageSize: 999 }));
    const body = (await res.json()) as { data: { hasMore: boolean } };

    expect(body.data.hasMore).toBe(true);
    expect(mockedServerRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "http://localhost:5002" }),
      "/api/v1/stops",
      expect.objectContaining({
        params: expect.objectContaining({ PageSize: 50 }),
      }),
    );
  });

  it("returns needsAuth for a trip without an actor token (no backend hit)", async () => {
    const res = await POST(req({ env: { envId: "local" }, kind: "trip" }));
    const body = (await res.json()) as { data: { needsAuth: boolean } };

    expect(res.status).toBe(200);
    expect(body.data.needsAuth).toBe(true);
    expect(mockedServerRequest).not.toHaveBeenCalled();
  });

  it("queries a booking with the selected actor token, never the admin identity", async () => {
    await getDevCredentialVault().setContext("7", "local", {
      accessToken: "actor-tok",
      expiresAt: Date.now() + 60_000,
    });
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: {
        items: [],
        pagination: { currentPage: 1, pageSize: 25, totalCount: 0 },
      },
      headers: {},
    });

    const res = await POST(
      req({ env: { envId: "local" }, kind: "booking", actorId: "7" }),
    );

    expect(res.status).toBe(200);
    expect(mockedServerRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "http://localhost:5002" }),
      "/api/v1/user-trips/me",
      expect.objectContaining({ token: "actor-tok" }),
    );
  });

  it("returns a typed backend error for a malformed paged envelope", async () => {
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: { unexpected: true },
      headers: {},
    });

    const res = await POST(req(base));
    const body = (await res.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(res.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("BACKEND");
  });
});
