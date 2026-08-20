import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActorType } from "@/features/actors/domain/actor.types";
import { createSessionEvent } from "@/features/sessions/application/sessionEventFactory";
import type { ExecutionRecord } from "@/features/sessions/domain/evidence.types";
import type { SessionEvent } from "@/features/sessions/domain/session.types";
import { SessionSource } from "@/features/sessions/domain/session.types";
import { I18nProvider } from "@/shared/i18n";
import { EventInspector } from "./EventInspector";

function renderInspector(event: SessionEvent | null) {
  return render(
    <I18nProvider>
      <EventInspector event={event} onClose={() => undefined} />
    </I18nProvider>,
  );
}

function baseEvent(): SessionEvent {
  return {
    id: "ev_1",
    seq: 1,
    ts: "2026-08-19T12:00:00.000Z",
    source: SessionSource.System,
    actorId: "a1",
    actorLabel: "Driver #7",
    actorType: ActorType.Driver,
    actionId: "map.follow",
    actionLabel: "Follow route",
    categoryId: "location",
    summary: "Followed route",
    status: "success",
  };
}

describe("EventInspector", () => {
  it("renders actor, action, and category metadata", () => {
    renderInspector(baseEvent());
    expect(screen.getByText("Driver #7 (driver)")).toBeInTheDocument();
    expect(screen.getByText("a1")).toBeInTheDocument();
    expect(screen.getByText("Follow route")).toBeInTheDocument();
    expect(screen.getByText("map.follow")).toBeInTheDocument();
    expect(screen.getByText("location")).toBeInTheDocument();
  });

  it("shows request method, url, headers, and body", () => {
    const ev = baseEvent();
    ev.request = {
      method: "POST",
      url: "http://localhost:5002/api/v1/bookings",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tripId: 9 }),
    };
    ev.response = {
      status: 201,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookingId: 184 }),
    };
    renderInspector(ev);

    expect(screen.getByText("POST")).toBeInTheDocument();
    expect(
      screen.getByText("http://localhost:5002/api/v1/bookings"),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/content-type/)).not.toHaveLength(0);
    expect(screen.getAllByText(/application\/json/)).not.toHaveLength(0);
    expect(screen.getByText(/tripId/)).toBeInTheDocument();
    expect(screen.getByText("201")).toBeInTheDocument();
    expect(screen.getByText(/bookingId/)).toBeInTheDocument();
  });

  it("shows correlation details when present", () => {
    const ev = baseEvent();
    ev.requestId = "req_abc";
    ev.executionId = "exec_xyz";
    ev.correlationId = "req_abc";
    ev.traceId = "trace_123";
    renderInspector(ev);

    expect(screen.getAllByText("req_abc")).toHaveLength(2);
    expect(screen.getByText("exec_xyz")).toBeInTheDocument();
    expect(screen.getByText("trace_123")).toBeInTheDocument();
  });

  it("shows the error for failed events", () => {
    const ev = baseEvent();
    ev.status = "failed";
    ev.error = "Backend rejected the booking";
    renderInspector(ev);
    expect(
      screen.getByText("Backend rejected the booking"),
    ).toBeInTheDocument();
  });

  it("shows the classification badge", () => {
    const ev = baseEvent();
    ev.classification = { kind: "infrastructure", subtype: "timeout" };
    renderInspector(ev);
    expect(screen.getAllByText("Infrastructure")).not.toHaveLength(0);
    expect(screen.getByText("Timeout")).toBeInTheDocument();
  });

  it("renders nothing when the event is null", () => {
    const { container } = renderInspector(null);
    expect(container.textContent).not.toContain("Follow route");
  });

  it("never renders secrets sanitized by the event factory", () => {
    const execution: ExecutionRecord = {
      requestId: "req_1",
      executionId: "exec_1",
      environmentId: "local",
      actorId: "a1",
      actionId: "trip.reserve",
      startedAt: "2026-08-19T12:00:00.000Z",
      durationMs: 42,
      request: {
        method: "POST",
        path: "/api/v1/bookings",
        headers: { authorization: "Bearer super-secret-token" },
        body: JSON.stringify({ accessToken: "super-secret-token", tripId: 9 }),
      },
      response: {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingId: 184 }),
      },
      classification: { kind: "success" },
    };
    const ev = createSessionEvent({
      source: SessionSource.Manual,
      actor: { id: "a1", label: "Passenger #1" },
      action: { id: "trip.reserve", label: "Reserve trip", categoryId: "trip" },
      summary: "Reserved trip #9",
      status: "success",
      execution,
      baseUrl: "http://localhost:5002",
    });

    const { container } = renderInspector(ev);
    expect(container.textContent).not.toContain("super-secret-token");
    expect(container.textContent).toContain("••••••••");
  });
});
