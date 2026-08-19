import { z } from "zod";

/** `UserTripStatus` enum from `Wusool.Api.Public.Domain.Enums`. */
export const UserTripStatusSchema = z.enum([
  "Requested",
  "Assigned",
  "Boarded",
  "Completed",
  "Cancelled",
]);
export type UserTripStatus = z.infer<typeof UserTripStatusSchema>;

/** `StopType` enum from `Wusool.Api.Geography.Domain.Enums`. */
export const StopTypeSchema = z.enum([
  "BusStop",
  "Terminal",
  "Depot",
  "Garage",
  "Interchange",
]);
export type StopType = z.infer<typeof StopTypeSchema>;

/** `RouteType` enum from `Wusool.Api.Geography.Domain.Enums`. */
export const RouteTypeSchema = z.enum([
  "Regular",
  "Express",
  "Limited",
  "School",
  "Charter",
]);
export type RouteType = z.infer<typeof RouteTypeSchema>;

/** `TripStatus` enum from `Wusool.Api.Public.Domain.Enums`. */
export const TripStatusSchema = z.enum([
  "SCHEDULED",
  "INPROGRESS",
  "COMPLETED",
  "CANCELED",
]);
export type TripStatus = z.infer<typeof TripStatusSchema>;

/** `ShiftType` enum from `Wusool.Api.operation.Domain.Enums`. */
export const ShiftTypeSchema = z.enum([
  "MORNING",
  "AFTERNOON",
  "EVENING",
  "NIGHT",
  "SPLIT",
]);
export type ShiftType = z.infer<typeof ShiftTypeSchema>;

/** `ShiftStatus` enum from `Wusool.Api.operation.Domain.Enums`. */
export const ShiftStatusSchema = z.enum([
  "SCHEDULED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "NOSHOW",
]);
export type ShiftStatus = z.infer<typeof ShiftStatusSchema>;

/** `BusStatus` enum from `Wusool.Api.operation.Domain.Enums`. */
export const BusStatusSchema = z.enum([
  "ACTIVE",
  "MAINTENANCE",
  "OUTOFSERVICE",
  "RETIRED",
  "RESERVEDBUS",
]);
export type BusStatus = z.infer<typeof BusStatusSchema>;

/** `FuelType` enum from `Wusool.Api.operation.Domain.Enums`. */
export const FuelTypeSchema = z.enum([
  "DIESEL",
  "ELECTRIC",
  "HYBRID",
  "CNG",
  "PETROL",
]);
export type FuelType = z.infer<typeof FuelTypeSchema>;

/** `IncidentType` enum from `Wusool.Api.operation.Domain.Enums`. */
export const IncidentTypeSchema = z.enum([
  "ACCIDENT",
  "BREAKDOWN",
  "PASSENGERINJURY",
  "MECHANICALFAILURE",
  "TRAFFICVIOLATION",
  "VANDALISM",
  "OTHER",
]);
export type IncidentType = z.infer<typeof IncidentTypeSchema>;

/** `SeverityLevel` enum from `Wusool.Api.operation.Domain.Enums`. */
export const SeverityLevelSchema = z.enum([
  "MINOR",
  "MODERATE",
  "MAJOR",
  "CRITICAL",
]);
export type SeverityLevel = z.infer<typeof SeverityLevelSchema>;

/** `InvestigationStatus` enum from `Wusool.Api.operation.Domain.Enums`. */
export const InvestigationStatusSchema = z.enum([
  "PENDING",
  "INPROGRESS",
  "COMPLETED",
  "RESOLVED",
  "CLOSED",
]);
export type InvestigationStatus = z.infer<typeof InvestigationStatusSchema>;
