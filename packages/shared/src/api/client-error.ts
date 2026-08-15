/**
 * The typed error every app's HTTP core throws for a non-2xx ApiError
 * envelope. Lives in shared (moved from each app's api/request.ts 2026-08-15)
 * so error-classification helpers (auth-flow, takedown-refusal, …) can live
 * in shared too and `instanceof ApiClientError` means ONE class everywhere —
 * two per-app copies could never be narrowed by shared code.
 */
export class ApiClientError extends Error {
  constructor(
    public statusCode: number,
    public error: string,
    message: string,
    /** Machine-readable ErrorCode from the API envelope. */
    public code?: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}
