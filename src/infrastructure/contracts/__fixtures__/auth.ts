import type { LoginResponse, RegisterCommand } from "../schemas/auth";

/**
 * Anonymized, hand-built sample `LoginResponse`. NOT real backend data — the
 * tokens are fabricated placeholders, never real credentials.
 */
export const loginResponseFixture: LoginResponse = {
  accessToken: "sample.access.token",
  refreshToken: "sample.refresh.token",
  requiresTwoFactor: false,
  twoFactorToken: null,
  twoFactorMethod: null,
};

/**
 * Anonymized, hand-built sample `RegisterCommand`. NOT real backend data.
 */
export const registerCommandFixture: RegisterCommand = {
  fullName: "Sample Passenger",
  email: "passenger.sample@example.com",
  password: "sample-password-not-secret",
  confirmPassword: "sample-password-not-secret",
  deviceFingerprint: null,
  name: "Sample Passenger",
  phone: null,
};
