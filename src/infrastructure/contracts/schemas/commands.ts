import { z } from "zod";

/**
 * `CreateUserTripCommand` — `POST /api/v1/user-trips`.
 */
export const CreateUserTripCommandSchema = z.object({
  startStopId: z.union([z.string(), z.number()]),
  endStopId: z.union([z.string(), z.number()]),
});
export type CreateUserTripCommand = z.infer<typeof CreateUserTripCommandSchema>;

/**
 * `ReserveSeatCommand` — `POST /api/v1/user-trips/reserve`.
 */
export const ReserveSeatCommandSchema = z.object({
  busTripId: z.union([z.string(), z.number()]),
  boardingStopId: z.union([z.string(), z.number()]),
  alightingStopId: z.union([z.string(), z.number()]),
});
export type ReserveSeatCommand = z.infer<typeof ReserveSeatCommandSchema>;

/**
 * `CancelUserTripCommand` — `POST /api/v1/user-trips/{UserTripId}/cancel`.
 */
export const CancelUserTripCommandSchema = z.object({
  reason: z.string().optional().nullable(),
});
export type CancelUserTripCommand = z.infer<typeof CancelUserTripCommandSchema>;

/**
 * `RateUserTripCommand` — `POST /api/v1/user-trips/{UserTripId}/rating`.
 */
export const RateUserTripCommandSchema = z.object({
  score: z.number().int().optional().nullable(),
  comment: z.string().optional().nullable(),
});
export type RateUserTripCommand = z.infer<typeof RateUserTripCommandSchema>;

/**
 * `AddFavoriteCommand` — `POST /api/v1/favorites`.
 */
export const AddFavoriteCommandSchema = z.object({
  type: z.string(),
  targetId: z.union([z.string(), z.number()]),
});
export type AddFavoriteCommand = z.infer<typeof AddFavoriteCommandSchema>;
