import { describe, expect, it } from "vitest";
import {
  bookingFixture,
  createUserTripResponseFixture,
} from "../__fixtures__/bookings";
import { busFixture } from "../__fixtures__/buses";
import {
  routeFixture,
  routeWithShortNameOnlyFixture,
} from "../__fixtures__/routes";
import { stopFixture, stopWithoutNameFixture } from "../__fixtures__/stops";
import {
  tripFixture,
  tripWithoutDepartureFixture,
} from "../__fixtures__/trips";
import { userFixture, userWithoutNamesFixture } from "../__fixtures__/users";
import type { BookableTripDto } from "../schemas/entity";
import { bookingMapper } from "./bookingMapper";
import { busMapper } from "./busMapper";
import { routeMapper } from "./routeMapper";
import { stopMapper } from "./stopMapper";
import { tripMapper } from "./tripMapper";
import { userMapper } from "./userMapper";

describe("stopMapper", () => {
  it("uses the flat name string", () => {
    expect(stopMapper(stopFixture)).toMatchObject({
      value: "101",
      label: "Central Station",
    });
  });

  it("degrades to `Stop <id>` when the name is missing", () => {
    expect(stopMapper(stopWithoutNameFixture).label).toBe("Stop 202");
  });
});

describe("routeMapper", () => {
  it("prefers shortName over name", () => {
    expect(routeMapper(routeFixture).label).toBe("R7");
  });

  it("falls back to shortName only", () => {
    expect(routeMapper(routeWithShortNameOnlyFixture).label).toBe("X8");
  });
});

describe("tripMapper", () => {
  it("labels as `routeName · departureTime`", () => {
    expect(tripMapper(tripFixture).label).toBe(
      "Downtown Loop · 2026-08-20T08:30:00Z",
    );
  });

  it("degrades to the id when departureTime is missing", () => {
    expect(tripMapper(tripWithoutDepartureFixture).label).toBe(
      "Airport Express · 4002",
    );
  });

  it("resolves a localized routeName and preserves routeId as meta", () => {
    const localizedTrip = {
      id: 88,
      routeId: "r9",
      routeName: { en: "Kufa Line", ar: "خط الكوفة" },
      departureTime: "2026-08-20T09:00:00Z",
    } as BookableTripDto;

    const mapped = tripMapper(localizedTrip);
    expect(mapped.label).toBe("Kufa Line · 2026-08-20T09:00:00Z");
    expect(mapped.meta?.routeId).toBe("r9");
  });
});

describe("bookingMapper", () => {
  it("labels as `boardingStopName → alightingStopName · status`", () => {
    expect(bookingMapper(bookingFixture).label).toBe(
      "Central Station → King Fahd Rd · Assigned",
    );
  });
});

describe("userMapper", () => {
  it("maps fullName + email to actor fields", () => {
    expect(userMapper(userFixture)).toMatchObject({
      id: "313",
      label: "Sample Passenger",
      sublabel: "passenger.sample@example.com",
    });
  });

  it("degrades to `User <id>` when names are missing", () => {
    expect(userMapper(userWithoutNamesFixture).label).toBe("User 314");
  });
});

describe("busMapper", () => {
  it("maps plateNumber + brand/model to actor fields", () => {
    expect(busMapper(busFixture)).toMatchObject({
      id: "9001",
      label: "ABC 1234",
      sublabel: "SampleBrand Model X",
    });
  });
});

describe("createUserTripResponse status", () => {
  it("keeps the enum status in the mapped raw payload", () => {
    expect(createUserTripResponseFixture.status).toBe("Requested");
  });
});
