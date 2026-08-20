/** Base class for all structured application errors. */
export class AppError extends Error {
  readonly code: string;
  readonly cause?: unknown;
  readonly status?: number;

  constructor(
    code: string,
    message: string,
    opts?: { cause?: unknown; status?: number },
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.cause = opts?.cause;
    this.status = opts?.status;
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, opts?: { cause?: unknown; status?: number }) {
    super("AUTHENTICATION", message, opts);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, opts?: { cause?: unknown }) {
    super("VALIDATION", message, opts);
  }
}

export class BackendUnavailableError extends AppError {
  constructor(message: string, opts?: { cause?: unknown }) {
    super("BACKEND_UNAVAILABLE", message, opts);
  }
}

export class ActionExecutionError extends AppError {
  constructor(message: string, opts?: { cause?: unknown; status?: number }) {
    super("ACTION_EXECUTION", message, opts);
  }
}

export class EnvironmentError extends AppError {
  constructor(message: string, opts?: { cause?: unknown }) {
    super("ENVIRONMENT", message, opts);
  }
}

export class SessionStorageError extends AppError {
  constructor(message: string, opts?: { cause?: unknown }) {
    super("SESSION_STORAGE", message, opts);
  }
}

export class SessionImportError extends AppError {
  constructor(message: string, opts?: { cause?: unknown }) {
    super("SESSION_IMPORT", message, opts);
  }
}
