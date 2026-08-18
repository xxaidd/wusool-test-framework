export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  /** Best-effort expiry (ms since epoch) parsed from the access token JWT. */
  expiresAt?: number;
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AuthError";
  }
}
