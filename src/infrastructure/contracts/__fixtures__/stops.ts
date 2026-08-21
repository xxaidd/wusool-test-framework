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

/**
 * Live-style stop whose `stopType` is a localized display string
 * (the real backend returns `"موقف حافلات"` for bus stops).
 * Must parse even though it is not a `StopType` enum value.
 */
export const stopWithLocalizedTypeFixture: StopDto = {
  id: 303,
  name: "King Saud Rd",
  description: null,
  stopType: "موقف حافلات",
  longitude: 46.7,
  latitude: 24.7,
  isActive: true,
  capacity: null,
  hasShelter: null,
  hasBench: null,
  wheelchairAccessible: null,
  created: null,
  lastModified: null,
};
