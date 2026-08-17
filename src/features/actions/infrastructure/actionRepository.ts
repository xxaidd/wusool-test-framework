import {
  ApiError,
  apiRequestDetailed,
} from "@/infrastructure/http/WusoolApiClient";
import type {
  ActionRepository,
  ActionRepositoryResult,
  ActionRequestInput,
} from "../application/actionRepository";

/** Default {@link ActionRepository} backed by the centralized HTTP client. */
export const httpActionRepository: ActionRepository = {
  async execute(input: ActionRequestInput): Promise<ActionRepositoryResult> {
    try {
      const { status, data } = await apiRequestDetailed(input.env, input.path, {
        method: input.method,
        token: input.token,
        params: input.params,
        data: input.data,
        signal: input.signal,
      });
      return { ok: true, status, data };
    } catch (err) {
      if (err instanceof ApiError) {
        return { ok: false, status: err.status, error: err.message };
      }
      return {
        ok: false,
        status: 0,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },
};
