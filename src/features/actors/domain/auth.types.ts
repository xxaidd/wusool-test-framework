export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  /** Best-effort expiry (ms since epoch) parsed from the access token JWT. */
  expiresAt?: number;
  /** Set when the backend login requires two-factor confirmation (unsupported gap). */
  requiresTwoFactor?: boolean;
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AuthError";
  }
}
