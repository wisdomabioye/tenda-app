import { AppError } from './errors'
import { ErrorCode } from '@tenda/shared'

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
 * Throws a 409 AppError if a TOCTOU-guarded DB update returned no row.
 * Use after transactions that include a status guard in the WHERE clause.
 */
export function ensureTxUpdated<T>(result: T | null | undefined, message: string): T {
  if (result == null) throw new AppError(409, ErrorCode.ESCROW_WRONG_STATUS, message)
  return result
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
