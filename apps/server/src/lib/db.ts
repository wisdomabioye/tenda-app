import { AppError } from './errors'
import type { ErrorCode } from '@tenda/shared'

/** Returns true if err is a Postgres unique-constraint violation (error code 23505). */
export function isPostgresUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  )
}

/**
 * Throws a 409 AppError if err is a unique-constraint violation, otherwise re-throws.
 * Use inside catch blocks to replace the isPostgresUniqueViolation + reply pattern.
 */
export function handleUniqueConflict(err: unknown, code: ErrorCode | string, message: string): never {
  if (isPostgresUniqueViolation(err)) {
    throw new AppError(409, code, message)
  }
  throw err as Error
}
