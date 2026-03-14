import http from 'node:http'
import type { ErrorCode } from '@tenda/shared'

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode | string,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }

  /** Human-readable HTTP status label derived from status code, e.g. "Not Found" for 404. */
  get errorLabel(): string {
    return http.STATUS_CODES[this.statusCode] ?? 'Error'
  }
}
