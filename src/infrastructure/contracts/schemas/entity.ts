import { z } from "zod";
import { StopTypeSchema, UserTripStatusSchema } from "./enums";

/**
 * `StopDto` — `GET /api/v1/stops` item.
 * `name` is a **flat string**, NOT a localized `{ en, ar }` object.
 */
export const StopDtoSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  stopType: StopTypeSchema.optional().nullable(),
  longitude: z.number().optional().nullable(),
  latitude: z.number().optional().nullable(),
  isActive: z.boolean().optional().nullable(),
  capacity: z.number().int().optional().nullable(),
  hasShelter: z.boolean().optional().nullable(),
  hasBench: z.boolean().optional().nullable(),
  wheelchairAccessible: z.boolean().optional().nullable(),
  created: z.string().optional().nullable(),
  lastModified: z.string().optional().nullable(),
});
export type StopDto = z.infer<typeof StopDtoSchema>;

/** Coordinate inside `RouteResponse.path`. */
export const CoordinateDtoSchema = z.object({
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});
export type CoordinateDto = z.infer<typeof CoordinateDtoSchema>;

/**
 * `RouteResponse` — `GET /api/v1/routes` item.
 * `name`/`shortName` are **flat strings**.
 */
export const RouteResponseSchema = z.object({
  id: z.union([z.string(), z.number()]),
  shortName: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  path: z.array(CoordinateDtoSchema).optional().nullable(),
  routeType: z.string().optional().nullable(),
  direction: z.string().optional().nullable(),
  averageDuration: z.string().optional().nullable(),
  firstDeparture: z.string().optional().nullable(),
  lastDeparture: z.string().optional().nullable(),
  frequencyPeak: z.string().optional().nullable(),
  frequencyOffPeak: z.string().optional().nullable(),
  isActive: z.boolean().optional().nullable(),
});
export type RouteResponse = z.infer<typeof RouteResponseSchema>;

/**
 * `BookableTripDto` — `GET /api/v1/bus-trips` item.
 * `routeName` is a **flat string**.
 */
export const BookableTripDtoSchema = z.object({
  id: z.union([z.string(), z.number()]),
  routeId: z.union([z.string(), z.number()]).optional().nullable(),
  routeName: z.string().optional().nullable(),
  startStopName: z.string().optional().nullable(),
  endStopName: z.string().optional().nullable(),
  departureTime: z.string().optional().nullable(),
  estimatedArrival: z.string().optional().nullable(),
  capacity: z.number().int().optional().nullable(),
  availableSeats: z.number().int().optional().nullable(),
  status: z.string().optional().nullable(),
  busId: z.union([z.string(), z.number()]).optional().nullable(),
  busPlate: z.string().optional().nullable(),
});
export type BookableTripDto = z.infer<typeof BookableTripDtoSchema>;

/**
 * `UserTripDto` — a passenger booking.
 * `boardingStopName`/`alightingStopName` are **flat strings**.
 */
export const UserTripDtoSchema = z.object({
  id: z.union([z.string(), z.number()]),
  busTripId: z.union([z.string(), z.number()]).optional().nullable(),
  status: UserTripStatusSchema.optional().nullable(),
  boardingStopId: z.union([z.string(), z.number()]).optional().nullable(),
  boardingStopName: z.string().optional().nullable(),
  alightingStopId: z.union([z.string(), z.number()]).optional().nullable(),
  alightingStopName: z.string().optional().nullable(),
  departureTime: z.string().optional().nullable(),
  cost: z.number().optional().nullable(),
  cancelledAt: z.string().optional().nullable(),
  cancelReason: z.string().optional().nullable(),
  rating: z.number().int().optional().nullable(),
  ratingComment: z.string().optional().nullable(),
  createdAt: z.string().optional().nullable(),
});
export type UserTripDto = z.infer<typeof UserTripDtoSchema>;

/**
 * `CreateUserTripResponse` — `POST /api/v1/user-trips` (201).
 */
export const CreateUserTripResponseSchema = z.object({
  userTripId: z.union([z.string(), z.number()]).optional().nullable(),
  userId: z.union([z.string(), z.number()]).optional().nullable(),
  busTripId: z.union([z.string(), z.number()]).optional().nullable(),
  startStopId: z.union([z.string(), z.number()]).optional().nullable(),
  startStopName: z.string().optional().nullable(),
  endStopId: z.union([z.string(), z.number()]).optional().nullable(),
  endStopName: z.string().optional().nullable(),
  cost: z.number().optional().nullable(),
  departureTime: z.string().optional().nullable(),
  arrivalTime: z.string().optional().nullable(),
  rating: z.number().int().optional().nullable(),
  createdAt: z.string().optional().nullable(),
  status: UserTripStatusSchema.optional().nullable(),
});
export type CreateUserTripResponse = z.infer<
  typeof CreateUserTripResponseSchema
>;

/**
 * `FavoriteDto` — `POST /api/v1/favorites` (201) and `GET /api/v1/favorites`.
 */
export const FavoriteDtoSchema = z.object({
  id: z.union([z.string(), z.number()]),
  type: z.string().optional().nullable(),
  targetId: z.union([z.string(), z.number()]).optional().nullable(),
  name: z.string().optional().nullable(),
  nameAr: z.string().optional().nullable(),
  createdAt: z.string().optional().nullable(),
});
export type FavoriteDto = z.infer<typeof FavoriteDtoSchema>;

/**
 * `DriverShiftDto` — `GET /api/v1/shifts/me` item.
 */
export const DriverShiftDtoSchema = z.object({
  id: z.union([z.string(), z.number()]),
  driverId: z.union([z.string(), z.number()]).optional().nullable(),
  busId: z.union([z.string(), z.number()]).optional().nullable(),
  routeId: z.union([z.string(), z.number()]).optional().nullable(),
  shiftDate: z.string().optional().nullable(),
  shiftType: z.string().optional().nullable(),
  scheduledStart: z.string().optional().nullable(),
  scheduledEnd: z.string().optional().nullable(),
  actualStart: z.string().optional().nullable(),
  actualEnd: z.string().optional().nullable(),
  checkInTime: z.string().optional().nullable(),
  checkOutTime: z.string().optional().nullable(),
  breakDuration: z.string().optional().nullable(),
  totalHours: z.number().optional().nullable(),
  overtimeHours: z.number().optional().nullable(),
  status: z.string().optional().nullable(),
  substituteDriverId: z.union([z.string(), z.number()]).optional().nullable(),
  cancellationReason: z.string().optional().nullable(),
  incidentsReported: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type DriverShiftDto = z.infer<typeof DriverShiftDtoSchema>;

/**
 * `IncidentDto` — incident payload.
 */
export const IncidentDtoSchema = z.object({
  id: z.union([z.string(), z.number()]),
  incidentType: z.string().optional().nullable(),
  severity: z.string().optional().nullable(),
  busId: z.union([z.string(), z.number()]).optional().nullable(),
  driverId: z.union([z.string(), z.number()]).optional().nullable(),
  shiftId: z.union([z.string(), z.number()]).optional().nullable(),
  incidentDate: z.string().optional().nullable(),
  locationDescription: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  passengersAffected: z.number().int().optional().nullable(),
  injuriesReported: z.number().int().optional().nullable(),
  policeReportNumber: z.string().optional().nullable(),
  insuranceClaimNumber: z.string().optional().nullable(),
  estimatedDamageCost: z.number().optional().nullable(),
  downtimeHours: z.number().optional().nullable(),
  investigationStatus: z.string().optional().nullable(),
  resolution: z.string().optional().nullable(),
  preventiveActions: z.string().optional().nullable(),
  reportedBy: z.string().optional().nullable(),
  investigatedBy: z.string().optional().nullable(),
  attachments: z.string().optional().nullable(),
  resolvedAt: z.string().optional().nullable(),
});
export type IncidentDto = z.infer<typeof IncidentDtoSchema>;
