import { isValidLatitude, isValidLongitude, ErrorCode } from '@tenda/shared'
import { AppError } from './errors'

/**
 * Throws a 400 AppError if either coordinate is present but out of valid range.
 * Accepts undefined/null (field not provided) without error.
 */
export function ensureValidCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): void {
  if (latitude != null && !isValidLatitude(latitude)) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'latitude must be between -90 and 90')
  }
  if (longitude != null && !isValidLongitude(longitude)) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'longitude must be between -180 and 180')
  }
}

/**
 * Throws a 400 AppError unless `value` is an integer within `[min, max]`.
 * Absent (undefined) passes — PATCH bodies are partial by design.
 *
 * Extracted from the admin platform-config route, which was accumulating one
 * hand-written copy of this check per tunable; the bounds themselves stay with
 * the caller so each field can cite its own source (ESCROW_LIMITS for
 * chain-mirrored caps, MAX_PENDING_GIGS_CEILING for the capacity ceiling).
 */
export function ensureIntInRange(
  value: number | undefined,
  field: string,
  min: number,
  max: number,
): void {
  if (value === undefined) return
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new AppError(
      400,
      ErrorCode.VALIDATION_ERROR,
      `${field} must be an integer between ${min} and ${max}`,
    )
  }
}
