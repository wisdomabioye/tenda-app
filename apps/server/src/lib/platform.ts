import { platform_config } from '@tenda/shared/db/schema'
import { getConfig } from '../config'
import type { AppDatabase } from '../plugins/db'

export interface PlatformConfig {
  fee_bps: number
  grace_period_seconds: number
}

let cache: PlatformConfig | null = null
let cacheExpiry = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Read platform configuration from the database.
 * Results are cached for 5 minutes to avoid a DB round-trip on every request.
 * Falls back to PLATFORM_FEE_BPS env var if the table has not been seeded yet.
 */
export async function getPlatformConfig(db: AppDatabase): Promise<PlatformConfig> {
  const now = Date.now()
  if (cache && now < cacheExpiry) {
    return cache
  }

  const [row] = await db.select().from(platform_config).limit(1)

  cache = row
    ? { fee_bps: row.fee_bps, grace_period_seconds: row.grace_period_seconds }
    : { fee_bps: getConfig().PLATFORM_FEE_BPS, grace_period_seconds: 86400 }

  cacheExpiry = now + CACHE_TTL_MS
  return cache
}
