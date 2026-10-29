import type { ApiErrorCode } from '../shared/api.model';

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
};

/**
 * The only error type the routes throw. Everything else that reaches the error
 * handler is treated as a bug and reported as INTERNAL_ERROR without leaking
 * its message to the client.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: readonly string[];

  constructor(code: ApiErrorCode, message: string, details?: readonly string[]) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}
