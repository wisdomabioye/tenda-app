import http from 'node:http'
import { ErrorCode } from '@tenda/shared'

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode | string,
    message: string,
    /**
     * Optional machine-readable payload serialized alongside the error
     * (e.g. WALLET_IN_USE returns the blocking escrow_ids). Keep it small
     * and JSON-safe — it goes straight to the client.
     */
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AppError'
  }

  /** Human-readable HTTP status label derived from status code, e.g. "Not Found" for 404. */
  get errorLabel(): string {
    return http.STATUS_CODES[this.statusCode] ?? 'Error'
  }
}

/**
 * Guard a request body before destructuring it. Fastify types `request.body`
 * as the declared Body shape, but at runtime it is `null` for a body-less
 * POST/PATCH — destructuring that throws a TypeError → 500. This narrows it
 * to a real object and returns a clean 400 instead (only null/undefined crash
 * a destructure; a non-object body yields `undefined` fields the route's own
 * validation already rejects).
 */
export function requireBody<T>(body: T): NonNullable<T> {
  if (body === null || body === undefined) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'request body is required')
  }
  return body
}
