import type { BookableTripDto } from "../schemas/entity";

/**
 * Anonymized, hand-built sample `BookableTripDto`. NOT real backend data.
 */
export const tripFixture: BookableTripDto = {
  id: 4001,
  routeId: 7,
  routeName: "Downtown Loop",
  startStopName: "Central Station",
  endStopName: "King Fahd Rd",
  departureTime: "2026-08-20T08:30:00Z",
  estimatedArrival: "2026-08-20T09:15:00Z",
  capacity: 50,
  availableSeats: 12,
  status: "SCHEDULED",
  busId: 9001,
  busPlate: "ABC 1234",
};

/** Trip with a route name only (no departure time) — mapper label still works. */
export const tripWithoutDepartureFixture: BookableTripDto = {
  id: 4002,
  routeId: 8,
  routeName: "Airport Express",
  startStopName: null,
  endStopName: null,
  departureTime: null,
  estimatedArrival: null,
  capacity: null,
  availableSeats: null,
  status: null,
  busId: null,
  busPlate: null,
};
