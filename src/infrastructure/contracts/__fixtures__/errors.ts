import type {
  ApiResponse,
  PagedResponse,
  PaginationMetadata,
} from "../schemas/apiResponse";
import type { ErrorResponse, ValidationError } from "../schemas/errorResponse";

/**
 * Anonymized, hand-built sample `ErrorResponse` matching the shape confirmed
 * live for `GET /api/v1/stops` without a token. NOT real backend data.
 */
export const errorResponseFixture: ErrorResponse = {
  success: false,
  message: "Authentication is required to access this resource.",
  errorCode: "UNAUTHORIZED",
  errors: [],
  metadata: null,
  timestamp: "2026-08-19T12:00:00Z",
  path: "/api/v1/stops",
  traceId: "0HNSAMPLE0001:00000001",
};

export const validationErrorsFixture: ValidationError[] = [
  {
    field: "email",
    message: "'email' is not a valid email address.",
    errorCode: "VALIDATION_ERROR",
    attemptedValue: "not-an-email",
  },
];

/**
 * Anonymized, hand-built sample `ApiResponse<PagedResponse<unknown>>` as
 * returned by `GET /api/v1/user-trips/me` (items are `System.Object` in the
 * spec, so they are intentionally typed as records here).
 */
export const pagedApiResponseFixture: ApiResponse & {
  data: PagedResponse<Record<string, unknown>>;
} = {
  success: true,
  data: {
    items: [
      {
        id: 555,
        busTripId: 4001,
        status: "Reserved",
        boardingStopName: "Central Station",
        alightingStopName: "King Fahd Rd",
      },
    ],
    pagination: {
      currentPage: 1,
      pageSize: 25,
      totalCount: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
      firstItemIndex: 1,
      lastItemIndex: 1,
    },
  },
  message: null,
  metadata: null,
  timestamp: "2026-08-19T12:00:00Z",
};

export const paginationFixture: PaginationMetadata = {
  currentPage: 1,
  pageSize: 25,
  totalCount: 40,
  totalPages: 2,
  hasNextPage: true,
  hasPreviousPage: false,
  firstItemIndex: 1,
  lastItemIndex: 25,
};
