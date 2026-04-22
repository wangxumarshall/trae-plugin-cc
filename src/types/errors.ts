export class TraeCliError extends Error {
  public readonly code: string;
  constructor(message: string, code: string = 'UNKNOWN') {
    super(message);
    this.name = 'TraeCliError';
    this.code = code;
  }
}

export class AuthError extends TraeCliError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthError';
  }
}

export class ExecutionError extends TraeCliError {
  public readonly exitCode?: number;
  constructor(message: string, exitCode?: number) {
    super(message, 'EXECUTION_ERROR');
    this.name = 'ExecutionError';
    this.exitCode = exitCode;
  }
}

export class SessionNotFoundError extends TraeCliError {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND');
    this.name = 'SessionNotFoundError';
  }
}

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function getErrorMessage(error: unknown): string {
  return isError(error) ? error.message : String(error);
}
