import { describe, expect, it } from "vitest";
import {
  cumulativeDistances,
  haversineMeters,
  positionAtDistance,
  routeLengthMeters,
} from "./distance";

describe("haversineMeters", () => {
  it("returns 0 for identical points", () => {
    expect(haversineMeters({ lat: 32, lng: 44 }, { lat: 32, lng: 44 })).toBe(0);
  });

  it("matches one degree of latitude (~111.2 km)", () => {
    const d = haversineMeters({ lat: 30, lng: 44 }, { lat: 31, lng: 44 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_500);
  });

  it("is symmetric", () => {
    const ab = haversineMeters({ lat: 1, lng: 2 }, { lat: 3, lng: 4 });
    const ba = haversineMeters({ lat: 3, lng: 4 }, { lat: 1, lng: 2 });
    expect(ab).toBeCloseTo(ba, 6);
  });
});

describe("cumulativeDistances", () => {
  it("returns [0] for a single point", () => {
    expect(cumulativeDistances([{ lat: 1, lng: 1 }])).toEqual([0]);
  });

  it("prefix-sums equal-length northward segments", () => {
    const cum = cumulativeDistances([
      { lat: 0, lng: 0 },
      { lat: 1, lng: 0 },
      { lat: 2, lng: 0 },
    ]);
    const seg = cum[1];
    expect(seg).toBeGreaterThan(110_000);
    expect(cum[2]).toBeCloseTo(seg * 2, 6);
    expect(cum[0]).toBe(0);
  });
});

describe("routeLengthMeters", () => {
  it("is 0 for empty or single-point routes", () => {
    expect(routeLengthMeters([])).toBe(0);
    expect(routeLengthMeters([{ lat: 5, lng: 5 }])).toBe(0);
  });

  it("equals the last cumulative distance", () => {
    const route = [
      { lat: 0, lng: 0 },
      { lat: 1, lng: 0 },
    ];
    expect(routeLengthMeters(route)).toBe(cumulativeDistances(route)[1]);
  });
});

describe("positionAtDistance", () => {
  const route = [
    { lat: 0, lng: 0 },
    { lat: 1, lng: 0 },
    { lat: 2, lng: 0 },
  ];
  const cum = cumulativeDistances(route);

  it("returns undefined for an empty route", () => {
    expect(positionAtDistance([], [], 10)).toBeUndefined();
  });

  it("clamps below zero and beyond the end", () => {
    expect(positionAtDistance(route, cum, -5)).toEqual({
      lat: 0,
      lng: 0,
    });
    expect(positionAtDistance(route, cum, Number.MAX_VALUE)).toEqual({
      lat: 2,
      lng: 0,
    });
  });

  it("interpolates the exact midpoint of a segment", () => {
    const pos = positionAtDistance(route, cum, cum[1] / 2);
    expect(pos?.lat).toBeCloseTo(0.5, 9);
    expect(pos?.lng).toBeCloseTo(0, 9);
  });

  it("interpolates across multiple segments", () => {
    const seg = cum[1];
    const pos = positionAtDistance(route, cum, seg * 1.25);
    expect(pos?.lat).toBeCloseTo(1.25, 9);
  });

  it("skips zero-length segments", () => {
    const dup = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0 },
      { lat: 1, lng: 0 },
    ];
    const dupCum = cumulativeDistances(dup);
    const pos = positionAtDistance(dup, dupCum, dupCum[2] / 2);
    expect(pos?.lat).toBeCloseTo(0.5, 9);
  });
});
