import type { StopDto } from "../schemas/entity";

/**
 * Anonymized, hand-built sample `StopDto`. NOT real backend data.
 */
export const stopFixture: StopDto = {
  id: 101,
  name: "Central Station",
  description: "Main interchange terminal",
  stopType: "Terminal",
  longitude: 46.6753,
  latitude: 24.7136,
  isActive: true,
  capacity: 120,
  hasShelter: true,
  hasBench: true,
  wheelchairAccessible: true,
  created: "2026-01-10T08:00:00Z",
  lastModified: "2026-01-10T08:00:00Z",
};

/** Stop without a name — must degrade to `Stop <id>`. */
export const stopWithoutNameFixture: StopDto = {
  id: 202,
  name: null,
  description: null,
  stopType: "BusStop",
  longitude: 0,
  latitude: 0,
  isActive: true,
  capacity: null,
  hasShelter: null,
  hasBench: null,
  wheelchairAccessible: null,
  created: null,
  lastModified: null,
};
