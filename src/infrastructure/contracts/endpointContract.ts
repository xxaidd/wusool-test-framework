import type { z } from "zod";
import { BusDtoSchema, UserDtoSchema } from "./schemas/actor";
import {
  apiPagedResponseSchema,
  apiResponseSchema,
} from "./schemas/apiResponse";
import {
  LoginCommandSchema,
  LoginResponseSchema,
  RefreshCommandSchema,
  RegisterCommandSchema,
  RegisterDriverCommandSchema,
  RegisterDriverResponseSchema,
  RegisterResponseSchema,
} from "./schemas/auth";
import {
  AddFavoriteCommandSchema,
  CancelUserTripCommandSchema,
  CreateUserTripCommandSchema,
  RateUserTripCommandSchema,
  ReserveSeatCommandSchema,
} from "./schemas/commands";
import {
  BookableTripDtoSchema,
  CreateUserTripResponseSchema,
  FavoriteDtoSchema,
  RouteResponseSchema,
  StopDtoSchema,
  UserTripDtoSchema,
} from "./schemas/entity";

/** Who must present a bearer token for the endpoint. */
export type EndpointAuth = "none" | "bearer" | "admin";

export type EndpointMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * A single verified (or flagged-unverified) backend endpoint. This is the
 * source of truth that maps framework action ids to real Wusool endpoints.
 * `requestSchema`/`responseSchema` validate the raw backend payload
 * (`ApiResponse<T>` envelope for responses).
 */
export interface EndpointContract {
  actionId: string;
  verified: boolean;
  method: EndpointMethod;
  /** Backend path template; `{Param}` segments match the spec. */
  path: string;
  auth: EndpointAuth;
  queryParams?: string[];
  requestSchema?: z.ZodTypeAny;
  responseSchema?: z.ZodTypeAny;
  /** Why this entry is flagged unverified, or contract caveats. */
  notes?: string;
}

/** Registry of every catalog action id → its backend contract. */
export const endpointContracts: EndpointContract[] = [
  // ---------- Auth (used by auth/actor repositories) ----------
  {
    actionId: "auth.login",
    verified: true,
    method: "POST",
    path: "/api/v1/auth/login",
    auth: "none",
    requestSchema: LoginCommandSchema,
    responseSchema: apiResponseSchema(LoginResponseSchema),
  },
  {
    actionId: "auth.register",
    verified: true,
    method: "POST",
    path: "/api/v1/auth/register",
    auth: "none",
    requestSchema: RegisterCommandSchema,
    responseSchema: apiResponseSchema(RegisterResponseSchema),
  },
  {
    actionId: "auth.refresh",
    verified: true,
    method: "POST",
    path: "/api/v1/auth/refresh",
    auth: "none",
    requestSchema: RefreshCommandSchema,
  },

  // ---------- Admin (discovery + driver creation) ----------
  {
    actionId: "admin.users",
    verified: true,
    method: "GET",
    path: "/api/v1/admin/users",
    auth: "admin",
    queryParams: [
      "SearchTerm",
      "IsActive",
      "IsVerified",
      "CreatedAfter",
      "CreatedBefore",
      "PageNumber",
      "PageSize",
      "OrderBy",
      "Descending",
      "RoleName",
    ],
    responseSchema: apiPagedResponseSchema(UserDtoSchema),
  },
  {
    actionId: "admin.driverCreate",
    verified: true,
    method: "POST",
    path: "/api/v1/admin/drivers",
    auth: "admin",
    requestSchema: RegisterDriverCommandSchema,
    responseSchema: apiResponseSchema(RegisterDriverResponseSchema),
  },

  // ---------- Passenger first slice ----------
  {
    actionId: "passenger.hail",
    verified: true,
    method: "POST",
    path: "/api/v1/user-trips",
    auth: "bearer",
    requestSchema: CreateUserTripCommandSchema,
    responseSchema: apiResponseSchema(CreateUserTripResponseSchema),
  },
  {
    actionId: "passenger.reserve",
    verified: true,
    method: "POST",
    path: "/api/v1/user-trips/reserve",
    auth: "bearer",
    requestSchema: ReserveSeatCommandSchema,
    responseSchema: apiResponseSchema(UserTripDtoSchema),
  },
  {
    actionId: "passenger.myBookings",
    verified: true,
    method: "GET",
    path: "/api/v1/user-trips/me",
    auth: "bearer",
    queryParams: [
      "BusTripId",
      "DepartureTime",
      "Rating",
      "StartStopId",
      "EndStopId",
      "Status",
      "PageNumber",
      "PageSize",
    ],
    responseSchema: apiPagedResponseSchema(UserTripDtoSchema),
    notes:
      "Item schema is System.Object in the spec; treated as UserTripDto by convention. Confirm with a runtime sample during contract testing.",
  },
  {
    actionId: "passenger.cancelBooking",
    verified: true,
    method: "POST",
    path: "/api/v1/user-trips/{UserTripId}/cancel",
    auth: "bearer",
    requestSchema: CancelUserTripCommandSchema,
    responseSchema: apiResponseSchema(UserTripDtoSchema),
  },
  {
    actionId: "passenger.rateTrip",
    verified: true,
    method: "POST",
    path: "/api/v1/user-trips/{UserTripId}/rating",
    auth: "bearer",
    requestSchema: RateUserTripCommandSchema,
    responseSchema: apiResponseSchema(UserTripDtoSchema),
  },
  {
    actionId: "passenger.discoverTrips",
    verified: true,
    method: "GET",
    path: "/api/v1/bus-trips",
    auth: "bearer",
    queryParams: ["RouteId", "FromStopId", "Date", "PageNumber", "PageSize"],
    responseSchema: apiPagedResponseSchema(BookableTripDtoSchema),
  },
  {
    actionId: "passenger.addFavorite",
    verified: true,
    method: "POST",
    path: "/api/v1/favorites",
    auth: "bearer",
    requestSchema: AddFavoriteCommandSchema,
    responseSchema: apiResponseSchema(FavoriteDtoSchema),
  },

  // ---------- Supporting discovery ----------
  {
    actionId: "general.listStops",
    verified: true,
    method: "GET",
    path: "/api/v1/stops",
    auth: "bearer",
    queryParams: [
      "Search",
      "SearchTerm",
      "StopType",
      "IsActive",
      "SortBy",
      "SortDescending",
      "PageNumber",
      "PageSize",
    ],
    responseSchema: apiPagedResponseSchema(StopDtoSchema),
  },
  {
    actionId: "general.listRoutes",
    verified: true,
    method: "GET",
    path: "/api/v1/routes",
    auth: "bearer",
    queryParams: [
      "Search",
      "SearchTerm",
      "IsActive",
      "RouteType",
      "SortBy",
      "IsSortAscending",
      "MinimumLengthMeters",
      "MaximumLengthMeters",
      "StopId",
      "PageNumber",
      "PageSize",
    ],
    responseSchema: apiPagedResponseSchema(RouteResponseSchema),
  },
  {
    actionId: "general.listBuses",
    verified: true,
    method: "GET",
    path: "/api/v1/buses",
    auth: "bearer",
    queryParams: [
      "PageNumber",
      "PageSize",
      "SearchTerm",
      "Brand",
      "Model",
      "Year",
      "Status",
      "SortBy",
      "SortDescending",
    ],
    responseSchema: apiPagedResponseSchema(BusDtoSchema),
  },

  // ---------- Driver / Bus (unverified — out of initial slice) ----------
  {
    actionId: "driver.startTrip",
    verified: false,
    method: "POST",
    path: "/api/v1/bus-trips/{BusTripId}/start",
    auth: "bearer",
    notes:
      "Endpoint exists in spec; runtime behavior unverified (Driver/Bus out of initial slice).",
  },
  {
    actionId: "driver.endTrip",
    verified: false,
    method: "POST",
    path: "/api/v1/bus-trips/{BusTripId}/end",
    auth: "bearer",
    notes: "Endpoint exists in spec; runtime behavior unverified.",
  },
  {
    actionId: "driver.reportIncident",
    verified: false,
    method: "POST",
    path: "/api/v1/incidents",
    auth: "bearer",
    notes: "Endpoint exists in spec; request/response schemas unverified.",
  },
  {
    actionId: "driver.myIncidents",
    verified: false,
    method: "GET",
    path: "/api/v1/incidents/me",
    auth: "bearer",
    notes: "Endpoint exists in spec; runtime behavior unverified.",
  },
  {
    actionId: "driver.myShifts",
    verified: false,
    method: "GET",
    path: "/api/v1/shifts/me",
    auth: "bearer",
    notes: "Endpoint exists in spec; runtime behavior unverified.",
  },
  {
    actionId: "driver.checkIn",
    verified: false,
    method: "POST",
    path: "/api/v1/shifts/me/{shiftId}/start",
    auth: "bearer",
    notes: "Endpoint exists in spec; runtime behavior unverified.",
  },
  {
    actionId: "driver.myBus",
    verified: false,
    method: "GET",
    path: "/api/v1/buses/by-driver/{driverId}",
    auth: "bearer",
    notes: "Endpoint exists in spec; runtime behavior unverified.",
  },
  {
    actionId: "bus.location",
    verified: false,
    method: "GET",
    path: "/api/v1/buses/{id}/location",
    auth: "bearer",
    notes: "Endpoint exists in spec; runtime behavior unverified.",
  },
  {
    actionId: "bus.detail",
    verified: false,
    method: "GET",
    path: "/api/v1/buses/{id}",
    auth: "bearer",
    notes: "Endpoint exists in spec; runtime behavior unverified.",
  },
];

const registry = new Map(
  endpointContracts.map((contract) => [contract.actionId, contract]),
);

/** Look up an endpoint contract by action id (verified or not). */
export function getEndpointContract(
  actionId: string,
): EndpointContract | undefined {
  return registry.get(actionId);
}

/** Look up only verified endpoint contracts. */
export function getVerifiedEndpointContract(
  actionId: string,
): EndpointContract | undefined {
  const contract = registry.get(actionId);
  return contract?.verified ? contract : undefined;
}

/** All verified endpoint contracts. */
export function verifiedEndpointContracts(): EndpointContract[] {
  return endpointContracts.filter((contract) => contract.verified);
}
