/**
 * Gig asset-policy guard. The canonical USDC asset per chain lives in
 * @tenda/shared (GIG_ASSET_BY_CHAIN) since CO5, the mobile chain picker reads
 * the SAME source, so client options and this guard can never disagree. Add a
 * chain there when its `chains` + `assets` rows are seeded.
 */

import { AppError } from '@server/lib/errors'
import { ErrorCode, GIG_ASSET_BY_CHAIN } from '@tenda/shared'
import type { AssetId, ChainId } from '@server/chains/types'

/**
 * Throws if `asset_id` isn't the gig-eligible USDC variant for `chain_id`.
 * Pure, does not consult the DB. The `assets` table is the canonical source
 * of truth for asset existence; this guard is a narrow policy filter layered
 * on top to enforce "USDC only" for gigs without a per-request DB roundtrip.
 *
 * Throws `ESCROW_INVALID_ASSET` (422) for both unknown chains and wrong assets,
 * route handlers should not distinguish the two (both are user-input errors).
 */
export function assertGigAsset(asset_id: AssetId, chain_id: ChainId): void {
  const expected = GIG_ASSET_BY_CHAIN[chain_id]
  if (expected === undefined) {
    throw new AppError(
      422,
      ErrorCode.ESCROW_INVALID_ASSET,
      `chain '${chain_id}' is not configured for gig escrows`,
    )
  }
  if (asset_id !== expected) {
    throw new AppError(
      422,
      ErrorCode.ESCROW_INVALID_ASSET,
      `gigs on '${chain_id}' must use '${expected}'; got '${asset_id}'`,
    )
  }
}
