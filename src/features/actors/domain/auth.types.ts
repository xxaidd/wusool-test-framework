export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
}

export interface UserProfile {
  userId?: string;
  fullName?: string;
  displayName?: string;
  email?: string;
}

export interface ActorAuthState {
  /** actorId -> JWT access token acquired via JIT authentication */
  tokens: Record<string, string>;
  /** actorId -> email used to authenticate (for display) */
  emails: Record<string, string>;
  /** true while a JIT auth prompt is open */
  promptOpenFor?: string;
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AuthError";
  }
}
