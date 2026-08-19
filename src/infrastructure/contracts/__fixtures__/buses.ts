import type { BusDto, BusLocationDto } from "../schemas/actor";

/**
 * Anonymized, hand-built sample `BusDto`. NOT real backend data.
 */
export const busFixture: BusDto = {
  id: 9001,
  plateNumber: "ABC 1234",
  capacity: 50,
  vin: "VIN-SAMPLE-0000001",
  seatedCapacity: 42,
  standingCapacity: 8,
  brand: "SampleBrand",
  model: "Model X",
  year: 2024,
  hasAc: true,
  hasWifi: false,
  hasUsbCharging: true,
  fuelType: "DIESEL",
  fuelCapacity: 300,
  currentKilometers: 45120,
  purchaseDate: "2024-03-01T00:00:00Z",
  purchasePrice: 220000,
  insuranceExpiry: "2027-03-01T00:00:00Z",
  registrationExpiry: "2027-03-01T00:00:00Z",
  lastServiceDate: "2026-07-01T00:00:00Z",
  nextServiceDate: "2026-10-01T00:00:00Z",
  nextServiceKilometers: 50000,
  status: "ACTIVE",
  currentDriverId: null,
  homeDepotStopId: 101,
  decommissionedAt: null,
  notes: null,
};

/**
 * Anonymized, hand-built sample `BusLocationDto`. NOT real backend data.
 */
export const busLocationFixture: BusLocationDto = {
  busId: 9001,
  longitude: 46.6753,
  latitude: 24.7136,
  updatedAt: "2026-08-19T10:30:00Z",
  source: "gps",
};
