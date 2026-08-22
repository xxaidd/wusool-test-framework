import { describe, expect, it, vi } from "vitest";
import type {
  LocationPort,
  LocationUpdateResult,
} from "../domain/locationPort";
import { sendActorLocation } from "./sendActorLocation";

function fakePort(): LocationPort & { sendLocation: ReturnType<typeof vi.fn> } {
  return {
    sendLocation: vi.fn(
      async (
        _actorId: string,
        _lat: number,
        _lng: number,
      ): Promise<LocationUpdateResult> => ({ ok: true }),
    ),
    getConnectionState: () => "disconnected",
    onConnectionChange: () => () => {},
    connect: async () => {},
    disconnect: async () => {},
  };
}

const ENV_REF = { envId: "env-1" };

describe("sendActorLocation", () => {
  it("delegates valid coordinates to the location port", async () => {
    const port = fakePort();
    const result = await sendActorLocation(
      { actorId: "driver-1", lat: 32.5, lng: 44.2, envRef: ENV_REF },
      port,
    );

    expect(result).toEqual({ ok: true });
    expect(port.sendLocation).toHaveBeenCalledTimes(1);
    expect(port.sendLocation).toHaveBeenCalledWith(
      "driver-1",
      32.5,
      44.2,
      ENV_REF,
    );
  });

  it.each([
    ["NaN latitude", Number.NaN, 44],
    ["NaN longitude", 32, Number.NaN],
    ["Infinity latitude", Number.POSITIVE_INFINITY, 44],
    ["latitude above range", 90.5, 44],
    ["latitude below range", -90.5, 44],
    ["longitude above range", 32, 180.5],
    ["longitude below range", 32, -180.5],
  ])("rejects %s before touching the port", async (_name, lat, lng) => {
    const port = fakePort();
    const result = await sendActorLocation(
      { actorId: "driver-1", lat, lng, envRef: ENV_REF },
      port,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.classification).toEqual({ kind: "validation" });
    }
    expect(port.sendLocation).not.toHaveBeenCalled();
  });

  it("requires an actor id", async () => {
    const port = fakePort();
    const result = await sendActorLocation(
      { actorId: "", lat: 32, lng: 44, envRef: ENV_REF },
      port,
    );

    expect(result.ok).toBe(false);
    expect(port.sendLocation).not.toHaveBeenCalled();
  });
});
