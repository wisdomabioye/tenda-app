/**
 * Asset-registry display metadata — the single source for symbol/decimals
 * per asset id, mirrored into the DB `assets` table by the server seed and
 * used directly by mobile for raw-unit → display conversion. Adding a new
 * asset: extend this map, then re-seed.
 */

export interface AssetMeta {
  symbol: string
  decimals: number
  is_stable: boolean
}

export const ASSET_META: Readonly<Record<string, AssetMeta>> = {
  SOL: { symbol: 'SOL', decimals: 9, is_stable: false },
  SOL_DEVNET: { symbol: 'SOL', decimals: 9, is_stable: false },
  USDC_SOL: { symbol: 'USDC', decimals: 6, is_stable: true },
  USDC_BASE: { symbol: 'USDC', decimals: 6, is_stable: true },
  ETH_BASE: { symbol: 'ETH', decimals: 18, is_stable: false },
  cUSD: { symbol: 'cUSD', decimals: 18, is_stable: true },
  USDC_CELO: { symbol: 'USDC', decimals: 6, is_stable: true },
  CELO: { symbol: 'CELO', decimals: 18, is_stable: false },
}

/**
 * Gig-eligible asset per chain (stablecoin policy: gigs are USDC-only so
 * pricing is intelligible — S0-3). SINGLE SOURCE shared by the server's
 * assertGigAsset guard and the mobile chain picker (CO5); a chain absent
 * here cannot carry gigs.
 */
export const GIG_ASSET_BY_CHAIN: Readonly<Partial<Record<string, string>>> = {
  'solana:mainnet': 'USDC_SOL',
  'solana:devnet': 'USDC_SOL',
  'eip155:8453': 'USDC_BASE',
  'eip155:84532': 'USDC_BASE',
  'eip155:42220': 'USDC_CELO',
  'eip155:44787': 'USDC_CELO',
}

/**
 * Client-side gig budget bounds for stable assets (raw units, 6dp USDC):
 * 1–50,000 USDC. Advisory UX rails — the program only enforces > 0.
 */
export const GIG_STABLE_MIN_RAW = 1_000_000
export const GIG_STABLE_MAX_RAW = 50_000_000_000

/** Display units for a raw integer amount ('5000000', 'USDC_SOL' → 5). */
export function amountRawToDisplay(amount_raw: string, asset: string): number {
  const meta = ASSET_META[asset]
  if (meta === undefined) return Number(amount_raw)
  return Number(amount_raw) / 10 ** meta.decimals
}

/** "5 USDC" / "0.05 SOL" — display-rounded, never for math. */
export function formatAssetAmount(amount_raw: string, asset: string): string {
  const meta = ASSET_META[asset]
  const value = amountRawToDisplay(amount_raw, asset)
  const symbol = meta?.symbol ?? asset
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${symbol}`
}
