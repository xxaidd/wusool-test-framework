import { z } from "zod";
import { BusStatusSchema, FuelTypeSchema } from "./enums";

/**
 * `UserDto` — `GET /api/v1/admin/users` item.
 */
export const UserDtoSchema = z.object({
  id: z.union([z.string(), z.number()]),
  email: z.string().optional().nullable(),
  fullName: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  isActive: z.boolean().optional().nullable(),
  isVerified: z.boolean().optional().nullable(),
  createdAt: z.string().optional().nullable(),
  lastLoginAt: z.string().optional().nullable(),
  roles: z.array(z.string()).optional().nullable(),
});
export type UserDto = z.infer<typeof UserDtoSchema>;

/**
 * `BusDto` — `GET /api/v1/buses` item.
 */
export const BusDtoSchema = z.object({
  id: z.union([z.string(), z.number()]),
  plateNumber: z.string().optional().nullable(),
  capacity: z.number().int().optional().nullable(),
  vin: z.string().optional().nullable(),
  seatedCapacity: z.number().int().optional().nullable(),
  standingCapacity: z.number().int().optional().nullable(),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  year: z.number().int().optional().nullable(),
  hasAc: z.boolean().optional().nullable(),
  hasWifi: z.boolean().optional().nullable(),
  hasUsbCharging: z.boolean().optional().nullable(),
  fuelType: FuelTypeSchema.optional().nullable(),
  fuelCapacity: z.number().optional().nullable(),
  currentKilometers: z.number().optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchasePrice: z.number().optional().nullable(),
  insuranceExpiry: z.string().optional().nullable(),
  registrationExpiry: z.string().optional().nullable(),
  lastServiceDate: z.string().optional().nullable(),
  nextServiceDate: z.string().optional().nullable(),
  nextServiceKilometers: z.number().optional().nullable(),
  status: BusStatusSchema.optional().nullable(),
  currentDriverId: z.union([z.string(), z.number()]).optional().nullable(),
  homeDepotStopId: z.union([z.string(), z.number()]).optional().nullable(),
  decommissionedAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type BusDto = z.infer<typeof BusDtoSchema>;

/**
 * `BusLocationDto` — bus location payload.
 */
export const BusLocationDtoSchema = z.object({
  busId: z.union([z.string(), z.number()]),
  longitude: z.number().optional().nullable(),
  latitude: z.number().optional().nullable(),
  updatedAt: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
});
export type BusLocationDto = z.infer<typeof BusLocationDtoSchema>;
