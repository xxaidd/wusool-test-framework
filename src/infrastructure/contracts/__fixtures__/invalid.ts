/** Samples that MUST be rejected by the schemas (invalid-shape tests). */

/** Missing id + wrong latitude type. */
export const invalidStop = {
  name: "No Id",
  latitude: "24.7",
};

/** `UserTripStatus` outside the declared enum. */
export const invalidTripStatus = "UnknownStatus";

/** `LoginCommand` missing the required password. */
export const invalidLoginCommand = {
  email: "passenger.sample@example.com",
};

/** `RegisterDriverCommand` missing the required confirmPassword. */
export const invalidRegisterDriverCommand = {
  fullName: "Sample Driver",
  email: "driver.sample@example.com",
  password: "sample-password-not-secret",
};

/** `ErrorResponse` with a non-array `errors` field. */
export const invalidErrorResponse = {
  success: false,
  message: "boom",
  errors: "not-an-array",
};

/** `CreateUserTripCommand` missing endStopId. */
export const invalidCreateUserTripCommand = {
  startStopId: 101,
};
