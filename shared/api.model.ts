/**
 * Every API response is one of these two shapes, so the renderer never has to
 * guess what came back.
 */

export interface ApiSuccess<T> {
  readonly data: T;
}

export const API_ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'INTERNAL_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
  readonly code: ApiErrorCode;
  /** Plain English, safe to log. User-facing text is produced by the renderer. */
  readonly message: string;
  /** Field-level detail for validation failures. */
  readonly details?: readonly string[];
}

export interface ApiFailure {
  readonly error: ApiErrorBody;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface HealthStatus {
  readonly status: 'ok';
  readonly uptimeSeconds: number;
}
