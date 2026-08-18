import {
  ApiError,
  apiRequestDetailed,
} from "@/infrastructure/http/WusoolApiClient";
import { classifyError, classifyHttpStatus } from "@/shared/errors";
import type {
  ActionRepository,
  ActionRequestInput,
  ActionResult,
} from "../application/actionRepository";

/** Default {@link ActionRepository} backed by the centralized HTTP client. */
export const httpActionRepository: ActionRepository = {
  async execute(input: ActionRequestInput): Promise<ActionResult> {
    const correlation = {};
    try {
      const { status, data } = await apiRequestDetailed(input.env, input.path, {
        method: input.method,
        token: input.token,
        params: input.params,
        data: input.data,
        signal: input.signal,
      });
      return { status: "success", statusCode: status, data, correlation };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401 || err.status === 403) {
          return { status: "needs-auth", correlation };
        }
        return {
          status: "failure",
          classification: classifyHttpStatus(err.status),
          statusCode: err.status,
          message: err.message,
          correlation,
        };
      }
      return {
        status: "failure",
        classification: classifyError(err),
        statusCode: 0,
        message: err instanceof Error ? err.message : "Unknown error",
        correlation,
      };
    }
  },
};
