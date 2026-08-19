import type { SessionEvent, SessionSource } from "../domain/session.types";

export interface TimelineFilter {
  /** Case-insensitive text match over actor/action labels, summary, and ids. */
  query?: string;
  /** Restrict to a single event source; "all" (default) shows every source. */
  source?: "all" | SessionSource;
  /** Restrict to a single outcome status; "all" (default) shows every status. */
  status?: "all" | SessionEvent["status"];
}

/**
 * Filter session events for the timeline. Pure and framework-free: text query,
 * source, and status filters are combined, and the result is returned in
 * chronological (`seq`) order without mutating the input array.
 */
export function filterSessionEvents(
  events: readonly SessionEvent[],
  filter: TimelineFilter = {},
): SessionEvent[] {
  const query = filter.query?.trim().toLowerCase() ?? "";
  const source = filter.source ?? "all";
  const status = filter.status ?? "all";

  const matchesQuery = (ev: SessionEvent): boolean => {
    if (query.length === 0) return true;
    const haystack = [
      ev.actorLabel,
      ev.summary,
      ev.actionLabel,
      ev.actionId,
      ev.actorId,
    ]
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  };

  return events
    .filter(
      (ev) =>
        (source === "all" || ev.source === source) &&
        (status === "all" || ev.status === status) &&
        matchesQuery(ev),
    )
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
}
