import { afterEach, describe, expect, it, vi } from "vitest";
import { haversineMeters } from "../domain/distance";
import type {
  ConnectionState,
  LocationPort,
  LocationUpdateResult,
} from "../domain/locationPort";
import type { LatLng } from "../domain/map.types";
import type { MovementEndOutcome } from "./movement";
import { startMoveActorAlongRoute } from "./movement";
import { sendActorLocation } from "./sendActorLocation";

afterEach(() => {
  vi.useRealTimers();
});

function useFakeClock(): void {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(0);
}

interface RecordedSend {
  actorId: string;
  pos: LatLng;
  result: LocationUpdateResult;
}

/** Minimal in-memory LocationPort capturing every send through the use case. */
function fakeLocationPort(): LocationPort & { sends: RecordedSend[] } {
  const sends: RecordedSend[] = [];
  return {
    sends,
    sendLocation: async (actorId, lat, lng) => {
      const result: LocationUpdateResult = { ok: true };
      sends.push({ actorId, pos: { lat, lng }, result });
      return result;
    },
    getConnectionState: (): ConnectionState => "disconnected",
    onConnectionChange: () => () => {},
    connect: async () => {},
    disconnect: async () => {},
  };
}

interface ReporterLog {
  started: LatLng[];
  ended: MovementEndOutcome[];
}

function reporter() {
  const log: ReporterLog = { started: [], ended: [] };
  return {
    log,
    events: {
      onStarted: (pos: LatLng) => log.started.push(pos),
      onPosition: () => {},
      onSendCompleted: () => {},
      onEnded: (outcome: MovementEndOutcome) => log.ended.push(outcome),
    },
  };
}

describe("movement over the unified location path", () => {
  it("records started, per-send outcomes, and completion through sendActorLocation", async () => {
    useFakeClock();
    const port = fakeLocationPort();
    const envRef = { envId: "env-1" };
    const route: LatLng[] = [
      { lat: 0, lng: 0 },
      { lat: 0.005, lng: 0 },
    ];
    const routeMeters = haversineMeters(route[0], route[1]);
    const rep = reporter();

    startMoveActorAlongRoute(
      { route, speedKmh: 36 },
      {
        ...rep.events,
        onSendCompleted: (pos) => {
          void pos;
        },
      },
      {
        sendLocation: (pos) =>
          sendActorLocation(
            { actorId: "driver-1", lat: pos.lat, lng: pos.lng, envRef },
            port,
          ),
      },
    );

    const durationMs = (routeMeters / (36_000 / 3600)) * 1_000;
    await vi.advanceTimersByTimeAsync(durationMs + 200);

    expect(rep.log.started).toHaveLength(1);
    expect(rep.log.ended).toHaveLength(1);
    expect(rep.log.ended[0]).toMatchObject({ type: "completed" });

    // Every backend update went through the unified validated path.
    expect(port.sends.length).toBeGreaterThanOrEqual(2);
    expect(port.sends[0].actorId).toBe("driver-1");
    expect(haversineMeters(route[0], port.sends[0].pos)).toBeLessThan(5);
    expect(port.sends[port.sends.length - 1].pos).toEqual(route[1]);

    // Positions progress monotonically along the route.
    let previous = -1;
    for (const send of port.sends) {
      const d = haversineMeters(route[0], send.pos);
      expect(d).toBeGreaterThanOrEqual(previous);
      previous = d;
    }
  });

  it("stops with a failure when the unified path rejects invalid coordinates", async () => {
    useFakeClock();
    const port = fakeLocationPort();
    const rep = reporter();
    // Route itself is out of range; the use case must reject before transport.
    const route: LatLng[] = [
      { lat: 500, lng: 10 },
      { lat: 500.001, lng: 10 },
    ];

    startMoveActorAlongRoute({ route, speedKmh: 36 }, rep.events, {
      sendLocation: (pos) =>
        sendActorLocation(
          {
            actorId: "driver-1",
            lat: pos.lat,
            lng: pos.lng,
            envRef: { envId: "e" },
          },
          port,
        ),
    });

    await vi.advanceTimersByTimeAsync(300);

    expect(port.sends).toHaveLength(0);
    expect(rep.log.ended).toHaveLength(1);
    expect(rep.log.ended[0]).toMatchObject({ type: "failed" });
    if (rep.log.ended[0].type === "failed") {
      expect(rep.log.ended[0].error).toContain("Latitude out of range");
    }
  });
});

describe("concurrent movement runs", () => {
  it("moves several actors independently without cross-talk", async () => {
    useFakeClock();
    const port = fakeLocationPort();
    const envRef = { envId: "env-1" };
    const makeRoute = (lngOffset: number): LatLng[] => [
      { lat: 0, lng: lngOffset },
      { lat: 0.002, lng: lngOffset },
    ];
    const actors = ["d1", "d2", "d3"];
    const reporters = actors.map(() => reporter());

    const handles = actors.map((id, i) =>
      startMoveActorAlongRoute(
        { route: makeRoute(i * 0.01), speedKmh: 36 },
        reporters[i].events,
        {
          sendLocation: (pos) =>
            sendActorLocation(
              { actorId: id, lat: pos.lat, lng: pos.lng, envRef },
              port,
            ),
        },
      ),
    );

    await vi.advanceTimersByTimeAsync(3_000);

    for (const handle of handles) handle.cancel();

    // Each actor only ever sent its own id and its own longitude lane.
    const byActor = new Map<string, RecordedSend[]>();
    for (const send of port.sends) {
      const list = byActor.get(send.actorId) ?? [];
      list.push(send);
      byActor.set(send.actorId, list);
    }
    expect([...byActor.keys()].sort()).toEqual(["d1", "d2", "d3"]);
    for (let i = 0; i < actors.length; i++) {
      const lane = i * 0.01;
      for (const send of byActor.get(actors[i]) ?? []) {
        expect(send.pos.lng).toBeCloseTo(lane, 6);
      }
    }
  });
});

describe("performance smoke", () => {
  it("simulates a long many-point route within bounded wall time and updates", async () => {
    useFakeClock();
    const port = fakeLocationPort();
    const positions: LatLng[] = [];

    // Closed loop of 240 points, radius ~0.02° (~14 km circumference).
    const route: LatLng[] = [];
    const points = 240;
    for (let i = 0; i < points; i++) {
      const angle = (2 * Math.PI * i) / (points - 1);
      route.push({
        lat: Number((0.02 * Math.sin(angle)).toFixed(7)),
        lng: Number((0.02 * Math.cos(angle)).toFixed(7)),
      });
    }
    const routeMeters = route.reduce(
      (sum, p, i) => (i === 0 ? 0 : sum + haversineMeters(route[i - 1], p)),
      0,
    );
    // 120 km/h ≈ 33.33 m/s → duration well under 10 simulated minutes.
    const durationMs = (routeMeters / (120_000 / 3600)) * 1_000;

    const handle = startMoveActorAlongRoute(
      { route, speedKmh: 120, sendIntervalMs: 1_000 },
      { onPosition: (pos) => positions.push(pos), onEnded: () => {} },
      {
        sendLocation: (pos) =>
          sendActorLocation(
            {
              actorId: "perf-driver",
              lat: pos.lat,
              lng: pos.lng,
              envRef: { envId: "e" },
            },
            port,
          ),
      },
    );

    const startedAt = performance.now();
    let advanced = 0;
    while (handle.isActive() && advanced < durationMs + 500) {
      await vi.advanceTimersByTimeAsync(1_000);
      advanced += 1_000;
    }
    const elapsedMs = performance.now() - startedAt;

    expect(handle.isActive()).toBe(false);
    // UI cadence bounds the emitted marker updates.
    expect(positions.length).toBeLessThanOrEqual(durationMs / 100 + 3);
    expect(elapsedMs).toBeLessThan(5_000);
  });
});
