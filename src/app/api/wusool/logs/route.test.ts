import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServerBackendLogRepository } from "@/features/sessions/infrastructure/serverBackendLogRepository";
import { POST } from "./route";

vi.mock(
  "@/features/sessions/infrastructure/serverBackendLogRepository",
  () => ({
    createServerBackendLogRepository: vi.fn(),
  }),
);

const mockedCreate = vi.mocked(createServerBackendLogRepository);

function req(body: unknown): Request {
  return new Request("http://localhost/api/wusool/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

interface FakeRepo {
  fetchForCorrelation: ReturnType<typeof vi.fn>;
}

function fakeRepo(
  result: unknown,
): ReturnType<typeof createServerBackendLogRepository> {
  return {
    fetchForCorrelation: vi.fn().mockResolvedValue(result),
  } as unknown as ReturnType<typeof createServerBackendLogRepository>;
}

describe("POST /api/wusool/logs", () => {
  beforeEach(() => {
    mockedCreate.mockReset();
  });

  it("returns sanitized entries for a valid request", async () => {
    const repo = fakeRepo({
      status: "success",
      entries: [
        { ts: "2026-08-19T12:00:00.000Z", level: "info", message: "handled" },
      ],
    }) as FakeRepo;
    mockedCreate.mockReturnValue(
      repo as unknown as ReturnType<typeof createServerBackendLogRepository>,
    );

    const res = await POST(
      req({ env: { envId: "local" }, correlationId: "req_1" }),
    );
    const body = (await res.json()) as {
      ok: boolean;
      data: { entries: unknown[] };
    };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.entries).toEqual([
      { ts: "2026-08-19T12:00:00.000Z", level: "info", message: "handled" },
    ]);
  });

  it("clamps the window and limit before querying", async () => {
    const repo = fakeRepo({ status: "success", entries: [] }) as FakeRepo;
    mockedCreate.mockReturnValue(
      repo as unknown as ReturnType<typeof createServerBackendLogRepository>,
    );

    const res = await POST(
      req({
        env: { envId: "local" },
        correlationId: "req_1",
        since: "2026-01-01T00:00:00.000Z",
        until: "2026-01-02T00:00:00.000Z",
        limit: 9999,
      }),
    );
    expect(res.status).toBe(200);

    const called = repo.fetchForCorrelation.mock.calls[0][0] as {
      since: string;
      until: string;
      limit: number;
    };
    const span = Date.parse(called.until) - Date.parse(called.since);
    expect(span).toBeLessThanOrEqual(10 * 60_000);
    expect(called.limit).toBe(500);
  });

  it("applies a default window around now when none is given", async () => {
    const repo = fakeRepo({ status: "success", entries: [] }) as FakeRepo;
    mockedCreate.mockReturnValue(
      repo as unknown as ReturnType<typeof createServerBackendLogRepository>,
    );

    const before = Date.now();
    const res = await POST(
      req({ env: { envId: "local" }, correlationId: "req_1" }),
    );
    const after = Date.now();
    expect(res.status).toBe(200);

    const called = repo.fetchForCorrelation.mock.calls[0][0] as {
      since: string;
      until: string;
    };
    expect(Date.parse(called.since)).toBeLessThanOrEqual(before);
    expect(Date.parse(called.until)).toBeGreaterThanOrEqual(after);
    expect(
      Date.parse(called.until) - Date.parse(called.since),
    ).toBeLessThanOrEqual(10 * 60_000);
  });

  it("returns LOG_API_UNAVAILABLE when the repo reports unavailable", async () => {
    mockedCreate.mockReturnValue(fakeRepo({ status: "unavailable" }));

    const res = await POST(
      req({ env: { envId: "local" }, correlationId: "req_1" }),
    );
    const body = (await res.json()) as { error: { code: string } };

    expect(res.status).toBe(501);
    expect(body.error.code).toBe("LOG_API_UNAVAILABLE");
  });

  it("returns an error result when the repo reports a failure", async () => {
    mockedCreate.mockReturnValue(
      fakeRepo({ status: "error", message: "connection refused" }),
    );

    const res = await POST(
      req({ env: { envId: "local" }, correlationId: "req_1" }),
    );
    const body = (await res.json()) as { error: { code: string } };

    expect(res.status).toBe(502);
    expect(body.error.code).toBe("BACKEND_LOG");
  });

  it("validates the request body", async () => {
    const res = await POST(req({ env: { envId: "local" } }));
    const body = (await res.json()) as { error: { code: string } };

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION");
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("rejects an invalid time window", async () => {
    const res = await POST(
      req({
        env: { envId: "local" },
        correlationId: "req_1",
        since: "not-a-date",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a reversed time window", async () => {
    const res = await POST(
      req({
        env: { envId: "local" },
        correlationId: "req_1",
        since: "2026-01-02T00:00:00.000Z",
        until: "2026-01-01T00:00:00.000Z",
      }),
    );
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION");
  });

  it("rejects an unknown environment", async () => {
    const res = await POST(
      req({ env: { envId: "nope" }, correlationId: "req_1" }),
    );
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("ENVIRONMENT");
  });
});
