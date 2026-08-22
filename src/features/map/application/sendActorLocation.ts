import type {
  LocationPort,
  LocationUpdateResult,
} from "../domain/locationPort";

export interface SendActorLocationInput {
  actorId: string;
  lat: number;
  lng: number;
  envRef: { envId: string; baseUrl?: string };
}

/**
 * Sends one verified actor location update through the location port.
 *
 * This is the single application path for backend location updates — the
 * manual confirm flow and automated movement both delegate here (AGENTS §13).
 * Coordinates are validated before any transport work happens.
 */
export async function sendActorLocation(
  input: SendActorLocationInput,
  locationPort: Pick<LocationPort, "sendLocation">,
): Promise<LocationUpdateResult> {
  const validationFailure = validateCoordinate(input.lat, input.lng);
  if (validationFailure) return validationFailure;

  if (!input.actorId) {
    return {
      ok: false,
      error: "Actor id is required for a location update",
      classification: { kind: "validation" },
    };
  }

  return locationPort.sendLocation(
    input.actorId,
    input.lat,
    input.lng,
    input.envRef,
  );
}

function validateCoordinate(
  lat: number,
  lng: number,
): LocationUpdateResult | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      ok: false,
      error: "Coordinates must be finite numbers",
      classification: { kind: "validation" },
    };
  }
  if (lat < -90 || lat > 90) {
    return {
      ok: false,
      error: `Latitude out of range [-90, 90]: ${lat}`,
      classification: { kind: "validation" },
    };
  }
  if (lng < -180 || lng > 180) {
    return {
      ok: false,
      error: `Longitude out of range [-180, 180]: ${lng}`,
      classification: { kind: "validation" },
    };
  }
  return null;
}
