import type { Credentials } from "@/features/actors/domain/actor.types";
import type { AuthTokens } from "@/features/actors/domain/auth.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { apiRequest } from "@/infrastructure/http/WusoolApiClient";

export async function login(
  env: BackendEnvironment,
  creds: Credentials,
  isDriver = false,
): Promise<AuthTokens> {
  const data = await apiRequest(
    env,
    isDriver ? "/api/v1/auth/driver/login" : "/api/v1/auth/login",
    {
      method: "POST",
      data: creds,
    },
  );
  const body = data as {
    accessToken?: string;
    token?: string;
    refreshToken?: string;
    tokenType?: string;
  };
  return {
    accessToken: body?.accessToken ?? body?.token ?? "",
    refreshToken: body?.refreshToken,
    tokenType: body?.tokenType,
  };
}

export async function guest(env: BackendEnvironment): Promise<string> {
  const data = await apiRequest(env, "/api/v1/auth/guest", { method: "POST" });
  return (data as { accessToken?: string })?.accessToken ?? "";
}

export async function registerPassenger(
  env: BackendEnvironment,
  input: { email: string; password: string; fullName?: string },
): Promise<{ tokens: AuthTokens; userId?: string }> {
  const data = await apiRequest(env, "/api/v1/auth/register", {
    method: "POST",
    data: {
      email: input.email,
      password: input.password,
      confirmPassword: input.password,
      fullName: input.fullName,
    },
  });
  const body = data as {
    accessToken?: string;
    token?: string;
    refreshToken?: string;
    user?: { userId?: string };
  };
  return {
    tokens: {
      accessToken: body?.accessToken ?? body?.token ?? "",
      refreshToken: body?.refreshToken,
    },
    userId: body?.user?.userId,
  };
}
