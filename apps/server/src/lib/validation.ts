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
