import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { SessionEvent } from "@/features/sessions/domain/session.types";
import { SessionSource } from "@/features/sessions/domain/session.types";
import { I18nProvider } from "@/shared/i18n";
import { SessionTimeline } from "./SessionTimeline";

function event(partial: Partial<SessionEvent>): SessionEvent {
  return {
    id: partial.id ?? "ev_1",
    seq: partial.seq ?? 1,
    ts: partial.ts ?? "2026-08-19T12:00:00.000Z",
    source: partial.source ?? SessionSource.Manual,
    actorId: partial.actorId ?? "a1",
    actorLabel: partial.actorLabel ?? "Passenger #1",
    actionId: partial.actionId ?? "trip.reserve",
    actionLabel: partial.actionLabel ?? "Reserve trip",
    categoryId: partial.categoryId ?? "trip",
    summary: partial.summary ?? "Reserved trip #9",
    status: partial.status ?? "success",
    ...partial,
  };
}

const events: SessionEvent[] = [
  event({
    id: "ev_1",
    seq: 1,
    actorLabel: "Passenger #1",
    summary: "Reserved trip #9",
    status: "success",
  }),
  event({
    id: "ev_2",
    seq: 2,
    source: SessionSource.Workflow,
    actorId: "a2",
    actorLabel: "Driver #7",
    actionLabel: "Send location",
    summary: "Sent location",
    status: "success",
  }),
  event({
    id: "ev_3",
    seq: 3,
    source: SessionSource.System,
    actorLabel: "System",
    actionId: "environment.switch",
    actionLabel: "Environment switched",
    summary: "local → staging",
    status: "info",
  }),
  event({
    id: "ev_4",
    seq: 4,
    actorId: "a1",
    actorLabel: "Passenger #1",
    actionId: "trip.cancel",
    actionLabel: "Cancel trip",
    summary: "Cancelled trip #9",
    status: "failed",
  }),
];

function renderTimeline(
  list: SessionEvent[] = events,
  onSelect: (e: SessionEvent) => void = () => undefined,
): ReactElement {
  return (
    <I18nProvider>
      <SessionTimeline events={list} onSelect={onSelect} />
    </I18nProvider>
  );
}

describe("SessionTimeline", () => {
  it("renders human-readable summaries by default", () => {
    render(renderTimeline());
    expect(screen.getByText(/Reserved trip #9/)).toBeInTheDocument();
    expect(screen.getByText(/Sent location/)).toBeInTheDocument();
    expect(screen.getByText(/Cancelled trip #9/)).toBeInTheDocument();
  });

  it("renders events in chronological seq order", () => {
    const { container } = render(renderTimeline());
    const rows = container.querySelectorAll("ol li button");
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent("Reserved trip #9");
    expect(rows[1]).toHaveTextContent("Sent location");
    expect(rows[3]).toHaveTextContent("Cancelled trip #9");
  });

  it("filters by source", () => {
    const { container } = render(renderTimeline());
    fireEvent.change(screen.getByLabelText("Source"), {
      target: { value: SessionSource.Workflow },
    });
    const rows = container.querySelectorAll("ol li button");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Sent location");
  });

  it("filters by status", () => {
    const { container } = render(renderTimeline());
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "failed" },
    });
    const rows = container.querySelectorAll("ol li button");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Cancelled trip #9");
  });

  it("filters by text query", async () => {
    const { container } = render(renderTimeline());
    fireEvent.change(screen.getByLabelText("Search events…"), {
      target: { value: "driver" },
    });
    await waitFor(() => {
      const rows = container.querySelectorAll("ol li button");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveTextContent("Sent location");
    });
  });

  it("shows a no-matches state when filters exclude everything", () => {
    render(renderTimeline());
    fireEvent.change(screen.getByLabelText("Search events…"), {
      target: { value: "nonexistent" },
    });
    expect(
      screen.getByText("No events match the current filters."),
    ).toBeInTheDocument();
  });

  it("selects an event via the keyboard", () => {
    const onSelect = vi.fn();
    render(renderTimeline(events, onSelect));
    const first = screen.getAllByRole("button")[0];
    first.focus();
    fireEvent.keyDown(first, { key: "Enter" });
    fireEvent.click(first);
    expect(onSelect).toHaveBeenCalledWith(events[0]);
  });
});
