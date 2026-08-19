import { z } from "zod";

/**
 * `LoginCommand` — `POST /api/v1/auth/login`.
 */
export const LoginCommandSchema = z.object({
  email: z.string(),
  password: z.string(),
  deviceFingerprint: z.string().optional().nullable(),
  deviceName: z.string().optional().nullable(),
});
export type LoginCommand = z.infer<typeof LoginCommandSchema>;

/**
 * `LoginResponse` — access + refresh tokens. 2FA is NOT handled by the
 * framework (known gap); `requiresTwoFactor`/`twoFactorToken` are captured so
 * the gap is visible rather than silently ignored.
 */
export const LoginResponseSchema = z.object({
  accessToken: z.string().optional().nullable(),
  refreshToken: z.string().optional().nullable(),
  requiresTwoFactor: z.boolean().optional().nullable(),
  twoFactorToken: z.string().optional().nullable(),
  twoFactorMethod: z.string().optional().nullable(),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/**
 * `GuestResponse` — `POST /api/v1/auth/guest`.
 */
export const GuestResponseSchema = z.object({
  accessToken: z.string().optional().nullable(),
});
export type GuestResponse = z.infer<typeof GuestResponseSchema>;

/**
 * `RegisterCommand` — `POST /api/v1/auth/register`.
 */
export const RegisterCommandSchema = z.object({
  fullName: z.string().optional().nullable(),
  email: z.string(),
  password: z.string(),
  confirmPassword: z.string().optional().nullable(),
  deviceFingerprint: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
});
export type RegisterCommand = z.infer<typeof RegisterCommandSchema>;

/**
 * `RegisterResponse` — returned by `POST /api/v1/auth/register` (201).
 */
export const RegisterResponseSchema = z.object({
  accessToken: z.string().optional().nullable(),
  refreshToken: z.string().optional().nullable(),
});
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

/**
 * `RegisterDriverCommand` — `POST /api/v1/admin/drivers`.
 * `confirmPassword` is required; the framework sends `confirmPassword =
 * password`.
 */
export const RegisterDriverCommandSchema = z.object({
  fullName: z.string(),
  email: z.string(),
  password: z.string(),
  confirmPassword: z.string(),
  activateUser: z.boolean().optional().nullable(),
});
export type RegisterDriverCommand = z.infer<typeof RegisterDriverCommandSchema>;

/**
 * `RegisterDriverResponse` — created driver payload.
 */
export const RegisterDriverResponseSchema = z.object({
  driverId: z.union([z.string(), z.number()]).optional().nullable(),
  email: z.string().optional().nullable(),
  fullName: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
  isActive: z.boolean().optional().nullable(),
});
export type RegisterDriverResponse = z.infer<
  typeof RegisterDriverResponseSchema
>;

/**
 * `DriverLoginCommand` — `POST /api/v1/auth/driver/login`.
 */
export const DriverLoginCommandSchema = z.object({
  email: z.string(),
  password: z.string(),
  deviceFingerprint: z.string().optional().nullable(),
  deviceName: z.string().optional().nullable(),
});
export type DriverLoginCommand = z.infer<typeof DriverLoginCommandSchema>;

/**
 * `DriverLoginResponse` — driver access + refresh tokens.
 */
export const DriverLoginResponseSchema = z.object({
  accessToken: z.string().optional().nullable(),
  refreshToken: z.string().optional().nullable(),
});
export type DriverLoginResponse = z.infer<typeof DriverLoginResponseSchema>;

/**
 * `RefreshCommand` — `POST /api/v1/auth/refresh`.
 */
export const RefreshCommandSchema = z.object({
  refreshToken: z.string(),
});
export type RefreshCommand = z.infer<typeof RefreshCommandSchema>;

/**
 * `AuthTokensResponse` — generalized token payload (refresh/login/register).
 */
export const AuthTokensResponseSchema = z.object({
  accessToken: z.string().optional().nullable(),
  token: z.string().optional().nullable(),
  refreshToken: z.string().optional().nullable(),
  tokenType: z.string().optional().nullable(),
  requiresTwoFactor: z.boolean().optional().nullable(),
  twoFactorToken: z.string().optional().nullable(),
});
export type AuthTokensResponse = z.infer<typeof AuthTokensResponseSchema>;
