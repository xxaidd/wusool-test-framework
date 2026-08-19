import type { CreateUserTripResponse, UserTripDto } from "../schemas/entity";

/**
 * Anonymized, hand-built sample `UserTripDto`. NOT real backend data.
 */
export const bookingFixture: UserTripDto = {
  id: 555,
  busTripId: 4001,
  status: "Assigned",
  boardingStopId: 101,
  boardingStopName: "Central Station",
  alightingStopId: 202,
  alightingStopName: "King Fahd Rd",
  departureTime: "2026-08-20T08:30:00Z",
  cost: 15,
  cancelledAt: null,
  cancelReason: null,
  rating: null,
  ratingComment: null,
  createdAt: "2026-08-19T10:00:00Z",
};

/**
 * Anonymized, hand-built sample `CreateUserTripResponse`. NOT real backend data.
 */
export const createUserTripResponseFixture: CreateUserTripResponse = {
  userTripId: 556,
  userId: 313,
  busTripId: 4001,
  startStopId: 101,
  startStopName: "Central Station",
  endStopId: 202,
  endStopName: "King Fahd Rd",
  cost: 15,
  departureTime: "2026-08-20T08:30:00Z",
  arrivalTime: "2026-08-20T09:15:00Z",
  rating: null,
  createdAt: "2026-08-19T10:00:00Z",
  status: "Requested",
};
