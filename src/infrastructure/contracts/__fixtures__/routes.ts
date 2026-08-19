import type { RouteResponse } from "../schemas/entity";

/**
 * Anonymized, hand-built sample `RouteResponse`. NOT real backend data.
 */
export const routeFixture: RouteResponse = {
  id: 7,
  shortName: "R7",
  name: "Downtown Loop",
  description: "Circular downtown route",
  path: [
    { latitude: 24.7136, longitude: 46.6753 },
    { latitude: 24.7221, longitude: 46.6759 },
  ],
  routeType: "Regular",
  direction: "clockwise",
  averageDuration: "00:45:00",
  firstDeparture: "05:30:00",
  lastDeparture: "23:30:00",
  frequencyPeak: "00:10:00",
  frequencyOffPeak: "00:20:00",
  isActive: true,
};

/** Route with a short name only (used by route mapper label precedence). */
export const routeWithShortNameOnlyFixture: RouteResponse = {
  id: 8,
  shortName: "X8",
  name: null,
  description: null,
  path: [],
  routeType: null,
  direction: null,
  averageDuration: null,
  firstDeparture: null,
  lastDeparture: null,
  frequencyPeak: null,
  frequencyOffPeak: null,
  isActive: true,
};
