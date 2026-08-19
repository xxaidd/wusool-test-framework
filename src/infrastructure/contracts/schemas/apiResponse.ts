import { z } from "zod";

/**
 * `ApiResponse<T>` — the standard backend response envelope.
 * `data` is the payload; it may be `null`/absent on failures.
 */
export function apiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.boolean(),
    data: dataSchema.optional().nullable(),
    message: z.string().optional().nullable(),
    metadata: z.unknown().optional().nullable(),
    timestamp: z.string().optional().nullable(),
  });
}

/** Loose envelope for callers that only need the wrapper shape. */
export const ApiResponseSchema = apiResponseSchema(z.unknown());
export type ApiResponse = z.infer<typeof ApiResponseSchema>;

/**
 * `PaginationMetadata` — the pagination block inside `PagedResponse<T>`.
 */
export const PaginationMetadataSchema = z.object({
  currentPage: z.number().int().optional(),
  pageSize: z.number().int().optional(),
  totalCount: z.number().int().optional(),
  totalPages: z.number().int().optional(),
  hasNextPage: z.boolean().optional(),
  hasPreviousPage: z.boolean().optional(),
  firstItemIndex: z.number().int().optional(),
  lastItemIndex: z.number().int().optional(),
});
export type PaginationMetadata = z.infer<typeof PaginationMetadataSchema>;

/**
 * `PagedResponse<T>` — `{ items, pagination }`. Located inside `data`.
 */
export function pagedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    pagination: PaginationMetadataSchema.optional().nullable(),
  });
}
export type PagedResponse<T> = {
  items: T[];
  pagination?: PaginationMetadata | null;
};

/** Convenience: full envelope `ApiResponse<PagedResponse<T>>`. */
export function apiPagedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return apiResponseSchema(pagedResponseSchema(itemSchema));
}
