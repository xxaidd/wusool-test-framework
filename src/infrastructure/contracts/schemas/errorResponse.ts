import { z } from "zod";

/**
 * `ValidationError` — a single field validation failure inside `ErrorResponse`.
 */
export const ValidationErrorSchema = z.object({
  field: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  errorCode: z.string().optional().nullable(),
  attemptedValue: z.unknown().optional().nullable(),
});
export type ValidationError = z.infer<typeof ValidationErrorSchema>;

/**
 * `ErrorResponse` — the backend's structured error body.
 * `path` and `traceId` are the correlation seed; the framework captures them
 * into `ServerApiError` (see `wusoolServerClient.ts`).
 */
export const ErrorResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional().nullable(),
  errorCode: z.string().optional().nullable(),
  errors: z.array(ValidationErrorSchema).optional().nullable(),
  metadata: z.unknown().optional().nullable(),
  timestamp: z.string().optional().nullable(),
  path: z.string().optional().nullable(),
  traceId: z.string().optional().nullable(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
