import { platform_config } from '@tenda/shared/db/schema'
import { PLATFORM_CONFIG_DEFAULTS } from '@tenda/shared'
import type { AppDatabase } from '@server/plugins/db'

/**
 * The whole singleton row. Inferred from the table rather than re-listed, so
 * a new tunable is readable here the moment the column exists — the previous
 * hand-written interface exposed only 3 of the 6 columns.
 */
export type PlatformConfig = typeof platform_config.$inferSelect

let cache: PlatformConfig | null = null
let cacheExpiry = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Invalidate the in-process cache.
 * Call this after an admin updates platform_config so the next request
 * reads fresh values from the DB instead of serving stale config.
 */
export function invalidatePlatformConfigCache(): void {
  cache = null
  cacheExpiry = 0
}

/**
 * Read platform configuration from the database.
 * Results are cached for 5 minutes to avoid a DB round-trip on every request.
 *
 * The unseeded fallback comes from the shared PLATFORM_CONFIG_DEFAULTS — the
 * same values the columns default to — so the two can no longer disagree.
 * (They did: the old fallback claimed a 24h grace period against a 1h column
 * default.) The fee is no longer overridable from the environment: it has two
 * sources already (the contract and this row), and `fee:set` keeps them in step.
 */
export async function getPlatformConfig(db: AppDatabase): Promise<PlatformConfig> {
  const now = Date.now()
  if (cache && now < cacheExpiry) {
    return cache
  }

  const [row] = await db.select().from(platform_config).limit(1)

  cache = row ?? { id: 1, ...PLATFORM_CONFIG_DEFAULTS }

  cacheExpiry = now + CACHE_TTL_MS
  return cache
}

