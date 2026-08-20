import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import type { LogFetchResult } from "@/features/sessions/application/BackendLogRepository";
import type { SessionEvent } from "@/features/sessions/domain/session.types";
import { SessionSource } from "@/features/sessions/domain/session.types";
import { createBackendLogRepository } from "@/features/sessions/infrastructure/backendLogRepository";
import { I18nProvider } from "@/shared/i18n";
import { useEnvironmentStore } from "@/shared/store/environment.store";
import { CorrelatedLogs } from "./CorrelatedLogs";

vi.mock("@/features/sessions/infrastructure/backendLogRepository", () => ({
  createBackendLogRepository: vi.fn(),
}));

const mockedCreate = vi.mocked(createBackendLogRepository);

type FakeRepo = ReturnType<typeof createBackendLogRepository>;

function repo(result: Partial<FakeRepo>): FakeRepo {
  return result as unknown as FakeRepo;
}

function event(correlationId?: string): SessionEvent {
  return {
    id: "ev_1",
    seq: 1,
    ts: "2026-08-19T12:00:00.000Z",
    source: SessionSource.Manual,
    actorId: "a1",
    actorLabel: "Passenger #1",
    actionId: "trip.reserve",
    actionLabel: "Reserve trip",
    categoryId: "trip",
    summary: "Reserved trip #9",
    status: "success",
    ...(correlationId != null ? { correlationId } : {}),
  };
}

function renderLogs(ev: SessionEvent) {
  return render(
    <I18nProvider>
      <CorrelatedLogs event={ev} />
    </I18nProvider>,
  );
}

describe("CorrelatedLogs", () => {
  beforeEach(() => {
    mockedCreate.mockReset();
    useEnvironmentStore.setState({
      env: {
        id: BackendEnvId.Local,
        label: "Local",
        baseUrl: "http://localhost:5002",
      },
    });
  });

  it("does not fetch on mount and shows the load button", () => {
    const fetchForCorrelation = vi.fn();
    mockedCreate.mockReturnValue(repo({ fetchForCorrelation }));

    renderLogs(event("req_abc"));

    expect(
      screen.getByRole("button", { name: "Show backend logs" }),
    ).toBeInTheDocument();
    expect(fetchForCorrelation).not.toHaveBeenCalled();
  });

  it("disables the load button and explains when no correlation exists", () => {
    mockedCreate.mockReturnValue(repo({ fetchForCorrelation: vi.fn() }));

    renderLogs(event());

    expect(
      screen.getByRole("button", { name: "Show backend logs" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "This event has no correlation ID to look up backend logs.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a loading state then renders entries", async () => {
    let resolveFetch!: (result: LogFetchResult) => void;
    const fetchForCorrelation = vi.fn(
      () =>
        new Promise<LogFetchResult>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    mockedCreate.mockReturnValue(repo({ fetchForCorrelation }));

    renderLogs(event("req_abc"));
    fireEvent.click(screen.getByRole("button", { name: "Show backend logs" }));

    expect(screen.getByText("Loading backend logs…")).toBeInTheDocument();

    await act(async () => {
      resolveFetch({
        status: "success",
        entries: [
          {
            ts: "2026-08-19T12:00:00.000Z",
            level: "info",
            message: "Request handled",
          },
        ],
      });
    });

    expect(screen.getByText("Request handled")).toBeInTheDocument();
    expect(screen.getByText("info")).toBeInTheDocument();
  });

  it("shows an empty state when no entries match", async () => {
    mockedCreate.mockReturnValue(
      repo({
        fetchForCorrelation: vi
          .fn()
          .mockResolvedValue({ status: "success", entries: [] }),
      }),
    );

    renderLogs(event("req_abc"));
    fireEvent.click(screen.getByRole("button", { name: "Show backend logs" }));

    await waitFor(() => {
      expect(
        screen.getByText("No backend logs found for this correlation."),
      ).toBeInTheDocument();
    });
  });

  it("shows the unavailable state", async () => {
    mockedCreate.mockReturnValue(
      repo({
        fetchForCorrelation: vi
          .fn()
          .mockResolvedValue({ status: "unavailable" }),
      }),
    );

    renderLogs(event("req_abc"));
    fireEvent.click(screen.getByRole("button", { name: "Show backend logs" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Backend log retrieval is not configured for this environment.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows the permission state", async () => {
    mockedCreate.mockReturnValue(
      repo({
        fetchForCorrelation: vi
          .fn()
          .mockResolvedValue({ status: "permission" }),
      }),
    );

    renderLogs(event("req_abc"));
    fireEvent.click(screen.getByRole("button", { name: "Show backend logs" }));

    await waitFor(() => {
      expect(
        screen.getByText("You do not have permission to view backend logs."),
      ).toBeInTheDocument();
    });
  });

  it("shows the error state with a message", async () => {
    mockedCreate.mockReturnValue(
      repo({
        fetchForCorrelation: vi.fn().mockResolvedValue({
          status: "error",
          message: "connection refused",
        }),
      }),
    );

    renderLogs(event("req_abc"));
    fireEvent.click(screen.getByRole("button", { name: "Show backend logs" }));

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load backend logs."),
      ).toBeInTheDocument();
      expect(screen.getByText("connection refused")).toBeInTheDocument();
    });
  });

  it("redacts secrets in log messages and metadata", async () => {
    mockedCreate.mockReturnValue(
      repo({
        fetchForCorrelation: vi.fn().mockResolvedValue({
          status: "success",
          entries: [
            {
              ts: "2026-08-19T12:00:00.000Z",
              level: "info",
              message: JSON.stringify({ accessToken: "super-secret-token" }),
              metadata: { authorization: "Bearer super-secret-token" },
            },
          ],
        }),
      }),
    );

    const { container } = renderLogs(event("req_abc"));
    fireEvent.click(screen.getByRole("button", { name: "Show backend logs" }));

    await waitFor(() => {
      expect(container.textContent).not.toContain("super-secret-token");
      expect(container.textContent).toContain("••••••••");
    });
  });

  it("aborts the in-flight request on unmount", async () => {
    let capturedSignal: AbortSignal | undefined;
    const fetchForCorrelation = vi.fn((input: { signal?: AbortSignal }) => {
      capturedSignal = input.signal;
      return new Promise<LogFetchResult>(() => undefined);
    });
    mockedCreate.mockReturnValue(repo({ fetchForCorrelation }));

    const { unmount } = renderLogs(event("req_abc"));
    fireEvent.click(screen.getByRole("button", { name: "Show backend logs" }));
    unmount();

    await waitFor(() => {
      expect(capturedSignal?.aborted).toBe(true);
    });
  });
});
