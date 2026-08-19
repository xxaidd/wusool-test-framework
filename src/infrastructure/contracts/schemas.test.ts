import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  loginResponseFixture,
  registerCommandFixture,
} from "./__fixtures__/auth";
import {
  bookingFixture,
  createUserTripResponseFixture,
} from "./__fixtures__/bookings";
import { busFixture, busLocationFixture } from "./__fixtures__/buses";
import {
  errorResponseFixture,
  pagedApiResponseFixture,
  paginationFixture,
  validationErrorsFixture,
} from "./__fixtures__/errors";
import {
  invalidCreateUserTripCommand,
  invalidErrorResponse,
  invalidLoginCommand,
  invalidRegisterDriverCommand,
  invalidStop,
  invalidTripStatus,
} from "./__fixtures__/invalid";
import {
  routeFixture,
  routeWithShortNameOnlyFixture,
} from "./__fixtures__/routes";
import { stopFixture, stopWithoutNameFixture } from "./__fixtures__/stops";
import { tripFixture, tripWithoutDepartureFixture } from "./__fixtures__/trips";
import { userFixture, userWithoutNamesFixture } from "./__fixtures__/users";
import {
  BusDtoSchema,
  BusLocationDtoSchema,
  UserDtoSchema,
} from "./schemas/actor";
import {
  apiPagedResponseSchema,
  PaginationMetadataSchema,
} from "./schemas/apiResponse";
import {
  LoginCommandSchema,
  LoginResponseSchema,
  RegisterCommandSchema,
  RegisterDriverCommandSchema,
} from "./schemas/auth";
import { CreateUserTripCommandSchema } from "./schemas/commands";
import {
  BookableTripDtoSchema,
  CreateUserTripResponseSchema,
  RouteResponseSchema,
  StopDtoSchema,
  UserTripDtoSchema,
} from "./schemas/entity";
import { UserTripStatusSchema } from "./schemas/enums";
import {
  ErrorResponseSchema,
  ValidationErrorSchema,
} from "./schemas/errorResponse";

describe("schema parsing — valid fixtures", () => {
  it.each([
    [stopFixture, StopDtoSchema],
    [stopWithoutNameFixture, StopDtoSchema],
    [routeFixture, RouteResponseSchema],
    [routeWithShortNameOnlyFixture, RouteResponseSchema],
    [tripFixture, BookableTripDtoSchema],
    [tripWithoutDepartureFixture, BookableTripDtoSchema],
    [bookingFixture, UserTripDtoSchema],
    [createUserTripResponseFixture, CreateUserTripResponseSchema],
    [userFixture, UserDtoSchema],
    [userWithoutNamesFixture, UserDtoSchema],
    [busFixture, BusDtoSchema],
    [busLocationFixture, BusLocationDtoSchema],
    [loginResponseFixture, LoginResponseSchema],
    [registerCommandFixture, RegisterCommandSchema],
    [errorResponseFixture, ErrorResponseSchema],
    [paginationFixture, PaginationMetadataSchema],
  ] as const)("parses %#", (value, schema) => {
    const result = schema.safeParse(value);
    expect(
      result.success,
      JSON.stringify(result.error?.issues ?? result.error),
    ).toBe(true);
  });

  it("parses the paged ApiResponse envelope (System.Object items)", () => {
    const schema = apiPagedResponseSchema(z.record(z.string(), z.unknown()));
    const result = schema.safeParse(pagedApiResponseFixture);
    expect(
      result.success,
      JSON.stringify(result.error?.issues ?? result.error),
    ).toBe(true);
  });

  it("parses every validation error", () => {
    for (const item of validationErrorsFixture) {
      expect(ValidationErrorSchema.safeParse(item).success).toBe(true);
    }
  });
});

describe("schema parsing — invalid samples rejected", () => {
  it.each([
    [invalidStop, StopDtoSchema],
    [invalidLoginCommand, LoginCommandSchema],
    [invalidRegisterDriverCommand, RegisterDriverCommandSchema],
    [invalidErrorResponse, ErrorResponseSchema],
    [invalidCreateUserTripCommand, CreateUserTripCommandSchema],
  ] as const)("rejects %#", (value, schema) => {
    expect(schema.safeParse(value).success).toBe(false);
  });

  it("rejects an out-of-enum UserTripStatus", () => {
    expect(UserTripStatusSchema.safeParse(invalidTripStatus).success).toBe(
      false,
    );
  });
});
