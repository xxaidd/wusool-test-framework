import { z } from "zod";

/** Generic backend response envelope: `{ success, data, message, ... }`. */
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional().nullable(),
  message: z.string().optional().nullable(),
  errors: z
    .array(z.object({ field: z.string().optional(), message: z.string() }))
    .optional(),
  statusCode: z.number().optional(),
});

/** Paged list envelope located inside `data`. */
export const PagedSchema = z.object({
  items: z.array(z.record(z.string(), z.unknown())).optional(),
  pagination: z.record(z.string(), z.unknown()).optional(),
});

export const EnvironmentConfigSchema = z.object({
  id: z.string().min(1),
  baseUrl: z.string().url("environment.urlRequired"),
});

export const CredentialsSchema = z.object({
  email: z.string().email("auth.emailInvalid"),
  password: z.string().min(4, "auth.passwordShort"),
});

export const CreatePassengerSchema = z.object({
  email: z.string().email("actor.emailInvalid"),
  password: z.string().min(6, "actor.passwordShort"),
  name: z.string().optional(),
});

export const CreateDriverSchema = z.object({
  email: z.string().email("actor.emailInvalid"),
  password: z.string().min(6, "actor.passwordShort"),
  name: z.string().min(1, "actor.nameRequired"),
});

export const CreateBusSchema = z.object({
  plateNumber: z.string().min(1, "actor.plateRequired"),
  capacity: z.number().min(1).optional(),
});

/** Parses an Axios error body into a readable message. */
export const ErrorEnvelopeSchema = z.object({
  message: z.string().optional(),
  title: z.string().optional(),
  errorCode: z.string().optional(),
  errors: z
    .array(z.object({ field: z.string().optional(), message: z.string() }))
    .optional(),
  statusCode: z.number().optional(),
});

export type ApiResponse = z.infer<typeof ApiResponseSchema>;
export type CredentialsInput = z.infer<typeof CredentialsSchema>;
