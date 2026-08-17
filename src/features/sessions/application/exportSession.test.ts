import { describe, expect, it, vi } from "vitest";
import { SessionStorageError } from "@/shared/errors";
import type { SessionEvent } from "../domain/session.types";
import { SessionSource } from "../domain/session.types";
import { exportSession } from "./exportSession";
import type { SessionDownloader } from "./sessionDownloader";

function event(): SessionEvent {
  return {
    id: "ev_1",
    ts: "2024-01-01T00:00:00.000Z",
    source: SessionSource.Manual,
    actorId: "7",
    actorLabel: "Driver 7",
    actionId: "driver.myBus",
    actionLabel: "My Bus",
    categoryId: "general",
    summary: "Loaded",
    status: "success",
  };
}

describe("exportSession", () => {
  it("serializes and hands the payload to the downloader", () => {
    const download = vi.fn<SessionDownloader["download"]>();
    exportSession({
      events: [event()],
      startedAt: "2024-01-01T00:00:00.000Z",
      download: { download },
    });

    expect(download).toHaveBeenCalledTimes(1);
    const arg = download.mock.calls[0][0];
    expect(arg.mimeType).toBe("application/json");
    expect(arg.startedAt).toBe("2024-01-01T00:00:00.000Z");
    const parsed = JSON.parse(arg.content) as {
      formatVersion: number;
      eventCount: number;
    };
    expect(parsed.formatVersion).toBe(1);
    expect(parsed.eventCount).toBe(1);
  });

  it("wraps downloader failures in SessionStorageError", () => {
    const download = vi
      .fn<SessionDownloader["download"]>()
      .mockImplementation(() => {
        throw new Error("disk full");
      });

    expect(() =>
      exportSession({ events: [event()], download: { download } }),
    ).toThrow(SessionStorageError);
  });
});
