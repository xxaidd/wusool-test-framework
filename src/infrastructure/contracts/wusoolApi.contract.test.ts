import axios from "axios";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { BusDtoSchema, UserDtoSchema } from "./schemas/actor";
import {
  apiPagedResponseSchema,
  apiResponseSchema,
} from "./schemas/apiResponse";
import { LoginResponseSchema } from "./schemas/auth";
import {
  BookableTripDtoSchema,
  RouteResponseSchema,
  StopDtoSchema,
  UserTripDtoSchema,
} from "./schemas/entity";

/**
 * Consumer-driven contract tests against the approved Wusool test backend.
 *
 * - Base URL: `WUSOOL_CONTRACT_BASE_URL` (default the pinned test env).
 *   Aborts if the URL looks like production or is not in the allowlist.
 * - Admin auth: `WUSOOL_CONTRACT_ADMIN_EMAIL` / `WUSOOL_CONTRACT_ADMIN_PASSWORD`
 *   (env-only). The token is never logged.
 * - Passenger flow: `WUSOOL_CONTRACT_PASSENGER_EMAIL` / `_PASSWORD`.
 *   Skipped with a notice when not provided.
 */

const DEFAULT_TEST_BASE_URL = "http://38.242.232.201:5002";

/** Conservative allowlist — production environments are NOT acceptable. */
const ALLOWED_TEST_BASE_URLS = [
  "http://38.242.232.201:5002",
  "http://localhost:5002",
  "http://127.0.0.1:5002",
];

const baseUrl = (
  process.env.WUSOOL_CONTRACT_BASE_URL ?? DEFAULT_TEST_BASE_URL
).replace(/\/$/, "");

function assertSafeContractBaseUrl(url: string): void {
  if (/\b(prod|production)\b/i.test(url)) {
    throw new Error(
      `Refusing to run contract tests against a production-looking URL: ${url}`,
    );
  }
  if (!ALLOWED_TEST_BASE_URLS.includes(url)) {
    throw new Error(
      `Contract base URL is not in the conservative allowlist: ${url}. ` +
        "Set WUSOOL_CONTRACT_BASE_URL to an approved test environment.",
    );
  }
}
assertSafeContractBaseUrl(baseUrl);

const ADMIN_EMAIL = process.env.WUSOOL_CONTRACT_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.WUSOOL_CONTRACT_ADMIN_PASSWORD;
const PASSENGER_EMAIL = process.env.WUSOOL_CONTRACT_PASSENGER_EMAIL;
const PASSENGER_PASSWORD = process.env.WUSOOL_CONTRACT_PASSENGER_PASSWORD;

const adminAvailable = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);
const passengerAvailable = Boolean(PASSENGER_EMAIL && PASSENGER_PASSWORD);

if (!adminAvailable) {
  console.warn(
    "contract: admin credentials not provided " +
      "(WUSOOL_CONTRACT_ADMIN_EMAIL/WUSOOL_CONTRACT_ADMIN_PASSWORD); admin tests skipped.",
  );
}
if (!passengerAvailable) {
  console.warn(
    "contract: passenger credentials not provided " +
      "(WUSOOL_CONTRACT_PASSENGER_EMAIL/WUSOOL_CONTRACT_PASSENGER_PASSWORD); passenger tests skipped.",
  );
}

interface RawResponse {
  status: number;
  data: unknown;
}

async function request(
  path: string,
  opts: { method?: string; token?: string; data?: unknown } = {},
): Promise<RawResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await axios.request({
    url: `${baseUrl}${path}`,
    method: opts.method ?? "GET",
    headers,
    data: opts.data,
    timeout: 20000,
    validateStatus: () => true,
  });
  return { status: res.status, data: res.data };
}

/** Login and return the access token. The token is never logged. */
async function obtainAccessToken(
  path: string,
  email: string,
  password: string,
): Promise<string> {
  const res = await request(path, {
    method: "POST",
    data: { email, password },
  });
  expect(res.status).toBe(200);
  const parsed = apiResponseSchema(LoginResponseSchema).safeParse(res.data);
  expect(
    parsed.success,
    JSON.stringify(parsed.error?.issues ?? parsed.error),
  ).toBe(true);
  const token = parsed.success ? parsed.data.data?.accessToken : undefined;
  expect(typeof token).toBe("string");
  if (!token) throw new Error("Login did not return an access token.");
  return token;
}

function expectParses<T extends z.ZodTypeAny>(
  res: RawResponse,
  schema: T,
  path: string,
): void {
  expect(res.status, `${path} returned ${res.status}`).toBe(200);
  const parsed = schema.safeParse(res.data);
  expect(
    parsed.success,
    `${path} body failed schema: ${JSON.stringify(parsed.error?.issues ?? parsed.error)}`,
  ).toBe(true);
}

describe("contract health", () => {
  it("GET / returns a healthy status", async () => {
    const res = await request("/");
    expect(res.status).toBe(200);
    const body = res.data as { status?: unknown };
    expect(body.status).toBe("Healthy");
  });
});

describe.skipIf(!adminAvailable)("admin contract", () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await obtainAccessToken(
      "/api/v1/auth/login",
      ADMIN_EMAIL as string,
      ADMIN_PASSWORD as string,
    );
  });

  it("GET /api/v1/admin/users parses against PagedResponse<UserDto>", async () => {
    expectParses(
      await request("/api/v1/admin/users?pageSize=5", { token: adminToken }),
      apiPagedResponseSchema(UserDtoSchema),
      "/api/v1/admin/users",
    );
  });

  it("GET /api/v1/stops parses against PagedResponse<StopDto>", async () => {
    expectParses(
      await request("/api/v1/stops?pageSize=5", { token: adminToken }),
      apiPagedResponseSchema(StopDtoSchema),
      "/api/v1/stops",
    );
  });

  it("GET /api/v1/routes parses against PagedResponse<RouteResponse>", async () => {
    expectParses(
      await request("/api/v1/routes?pageSize=5", { token: adminToken }),
      apiPagedResponseSchema(RouteResponseSchema),
      "/api/v1/routes",
    );
  });

  it("GET /api/v1/bus-trips parses against PagedResponse<BookableTripDto>", async () => {
    expectParses(
      await request("/api/v1/bus-trips?pageSize=5", { token: adminToken }),
      apiPagedResponseSchema(BookableTripDtoSchema),
      "/api/v1/bus-trips",
    );
  });

  it("GET /api/v1/buses parses against PagedResponse<BusDto>", async () => {
    expectParses(
      await request("/api/v1/buses?pageSize=5", { token: adminToken }),
      apiPagedResponseSchema(BusDtoSchema),
      "/api/v1/buses",
    );
  });
});

describe.skipIf(!passengerAvailable)("passenger contract", () => {
  let passengerToken: string;

  beforeAll(async () => {
    passengerToken = await obtainAccessToken(
      "/api/v1/auth/login",
      PASSENGER_EMAIL as string,
      PASSENGER_PASSWORD as string,
    );
  });

  it("GET /api/v1/user-trips/me returns items that parse as UserTripDto", async () => {
    const res = await request("/api/v1/user-trips/me?pageSize=5", {
      token: passengerToken,
    });
    expect(res.status).toBe(200);
    const envelope = apiResponseSchema(
      z.object({
        items: z.array(z.unknown()),
        pagination: z.unknown().optional().nullable(),
      }),
    ).safeParse(res.data);
    expect(
      envelope.success,
      JSON.stringify(envelope.error?.issues ?? envelope.error),
    ).toBe(true);
    const items = envelope.success
      ? ((envelope.data.data as { items?: unknown[] } | null)?.items ?? [])
      : [];
    // System.Object in the spec; confirm the conventional UserTripDto shape.
    for (const item of items) {
      const parsed = UserTripDtoSchema.safeParse(item);
      expect(
        parsed.success,
        `user-trips/me item failed: ${JSON.stringify(item)}`,
      ).toBe(true);
    }
  });

  it("GET /api/v1/bus-trips parses with a passenger token", async () => {
    expectParses(
      await request("/api/v1/bus-trips?pageSize=5", { token: passengerToken }),
      apiPagedResponseSchema(BookableTripDtoSchema),
      "/api/v1/bus-trips",
    );
  });
});
