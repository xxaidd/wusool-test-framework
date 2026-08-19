import type { UserDto } from "../schemas/actor";

/**
 * Anonymized, hand-built sample `UserDto`. NOT real backend data — the email
 * is a fabricated placeholder, never a real credential.
 */
export const userFixture: UserDto = {
  id: 313,
  email: "passenger.sample@example.com",
  fullName: "Sample Passenger",
  phoneNumber: "+15550000123",
  isActive: true,
  isVerified: true,
  createdAt: "2026-01-05T09:00:00Z",
  lastLoginAt: "2026-08-18T12:00:00Z",
  roles: ["Passenger"],
};

/** User with an id but no name/email — userMapper must degrade gracefully. */
export const userWithoutNamesFixture: UserDto = {
  id: 314,
  email: null,
  fullName: null,
  phoneNumber: null,
  isActive: false,
  isVerified: false,
  createdAt: null,
  lastLoginAt: null,
  roles: [],
};
