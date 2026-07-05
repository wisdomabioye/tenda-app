/**
 * Validation + normalisation for the gig create-detail body
 * (POST /v1/gigs, cutover §3). Pure: DB guards (escrow ownership/state)
 * and the Stage-6 moderation gate stay in the route; everything testable
 * without I/O lives here.
 */
import {
  isCityInCountry,
  isCrossBorder,
  MAX_GIG_TITLE_LENGTH,
  MAX_GIG_DESCRIPTION_LENGTH,
  LOCATIONS,
  GIG_CATEGORIES,
  ErrorCode,
} from '@tenda/shared'
import type { CreateGigDetailsBody, GigCategory, CountryCode } from '@tenda/shared'
import { AppError } from './errors'
import { ensureValidCoordinates } from './validation'

export interface ValidatedGigDetails {
  title: string
  description: string | null
  category: GigCategory
  country: CountryCode | null
  city: string | null
  latitude: number | null
  longitude: number | null
  remote: boolean
  cross_border: boolean
}

function fail(message: string): never {
  throw new AppError(400, ErrorCode.VALIDATION_ERROR, message)
}

/**
 * Validates the listing fields. Remote gigs carry no country/city; physical
 * gigs require both (the work location). The cross-border flag is derived by
 * comparing the work country against the creator's stored country. Throws
 * AppError(400) on the first violation.
 */
export function validateGigDetails(
  body: Partial<CreateGigDetailsBody>,
  creatorCountry: string | null,
): ValidatedGigDetails {
  const { title, description, category, country, remote = false, city, latitude, longitude } = body

  if (typeof title !== 'string' || title.trim() === '') fail('title is required')
  if (title.length > MAX_GIG_TITLE_LENGTH) {
    fail(`Title must be at most ${MAX_GIG_TITLE_LENGTH} characters`)
  }
  if (description !== undefined && description !== null && description.length > MAX_GIG_DESCRIPTION_LENGTH) {
    fail(`Description must be at most ${MAX_GIG_DESCRIPTION_LENGTH} characters`)
  }
  if (!GIG_CATEGORIES.includes(category as GigCategory)) {
    fail(`category must be one of: ${GIG_CATEGORIES.join(', ')}`)
  }
  if (!remote && !city) fail('city is required for non-remote gigs')
  if (!remote && !country) fail('country is required for non-remote gigs')
  ensureValidCoordinates(latitude, longitude)

  // Remote gigs are location-agnostic: they carry no country or city. Physical
  // gigs must name the country (and city) where the WORK happens, the worker's
  // location, independent of where the poster posts from. We never back-fill the
  // creator's country onto a remote gig.
  let resolvedCountry: CountryCode | null = null
  if (!remote) {
    resolvedCountry = country as CountryCode
    if (!(resolvedCountry in LOCATIONS)) {
      fail(`country must be one of: ${Object.keys(LOCATIONS).join(', ')}`)
    }
    if (city && !isCityInCountry(resolvedCountry, city)) {
      fail(`city "${city}" is not in country ${resolvedCountry}`)
    }
  }

  return {
    title: title.trim(),
    description: description?.trim() || null,
    category: category as GigCategory,
    country: resolvedCountry,
    city: remote ? null : (city ?? null),
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    remote,
    cross_border: isCrossBorder(remote, resolvedCountry, creatorCountry),
  }
}
