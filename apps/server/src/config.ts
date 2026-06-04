const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'SOLANA_RPC_URL',
  'SOLANA_TREASURY_ADDRESS',
  'SOLANA_PROGRAM_ID',
  'API_BASE_URL',
] as const

export interface Config {
  DATABASE_URL: string
  JWT_SECRET: string
  CLOUDINARY_CLOUD_NAME: string
  CLOUDINARY_API_KEY: string
  CLOUDINARY_API_SECRET: string
  SOLANA_RPC_URL: string
  SOLANA_TREASURY_ADDRESS: string  // platform treasury wallet — required for approve_completion
  /**
   * Public base URL of this API deployment (no trailing slash). Used by the
   * wallet auth flow to assert the `URI:` line of the signed auth message
   * matches this server — cross-deployment replay defense per
   * stage-1-onboarding.md L263.
   */
  API_BASE_URL: string
  // Optional — defaults applied here; do not re-read from process.env elsewhere
  PLATFORM_FEE_BPS: number       // seed fallback only — runtime fee is read from platform_config table
  SOLANA_PROGRAM_ID: string
  JWT_EXPIRES_IN: string         // e.g. '7d', '24h'
  SOLANA_NETWORK: string         // 'devnet' | 'testnet' | 'mainnet-beta'
  /**
   * SPL mint address for the USDC asset on the configured network. Interim
   * asset source until the Stage-0 cutover seeds the `assets` table — the
   * chains plugin resolves `'USDC_SOL'` through this value. Null = USDC
   * escrows rejected with a clear error (native SOL still works).
   */
  SOLANA_USDC_MINT: string | null
  /**
   * Termii credentials for phone OTP (#32). Null = OTP codes are logged to
   * the server console instead of sent — development interim only.
   */
  TERMII_API_KEY: string | null
  TERMII_SENDER_ID: string | null
  /**
   * base58-encoded secret key of the Solana gas-seed hot wallet (#40).
   * Null = gas seeds are skipped with a logged warning.
   */
  SOLANA_GAS_SEED_WALLET_KEY: string | null
  CORS_ORIGIN:  string[] | null  // null = allow any origin (dev); set to domain list in production
  ADMIN_ORIGIN: string[] | null  // null = allow any origin (dev); set to admin panel domain in production
}

let _config: Config | undefined

export function loadConfig(): Config {
  const missing: string[] = []

  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  // Validate SOLANA_PROGRAM_ID is a valid base58 Solana public key (32–44 chars)
  const programId = process.env.SOLANA_PROGRAM_ID!
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(programId)) {
    throw new Error('SOLANA_PROGRAM_ID is not a valid Solana public key (expected base58, 32–44 chars)')
  }

  _config = {
    DATABASE_URL:          process.env.DATABASE_URL!,
    JWT_SECRET:            process.env.JWT_SECRET!,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME!,
    CLOUDINARY_API_KEY:    process.env.CLOUDINARY_API_KEY!,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET!,
    SOLANA_RPC_URL:          process.env.SOLANA_RPC_URL!,
    SOLANA_TREASURY_ADDRESS: process.env.SOLANA_TREASURY_ADDRESS!,
    API_BASE_URL:            stripTrailingSlash(process.env.API_BASE_URL!),
    PLATFORM_FEE_BPS:      Number(process.env.PLATFORM_FEE_BPS ?? 250),
    SOLANA_PROGRAM_ID:     programId,
    JWT_EXPIRES_IN:        process.env.JWT_EXPIRES_IN ?? '7d',
    SOLANA_NETWORK:        process.env.SOLANA_NETWORK ?? 'devnet',
    SOLANA_USDC_MINT:      process.env.SOLANA_USDC_MINT ?? null,
    TERMII_API_KEY:        process.env.TERMII_API_KEY ?? null,
    TERMII_SENDER_ID:      process.env.TERMII_SENDER_ID ?? null,
    SOLANA_GAS_SEED_WALLET_KEY: process.env.SOLANA_GAS_SEED_WALLET_KEY ?? null,
    CORS_ORIGIN:           process.env.CORS_ORIGIN
                             ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
                             : null,
    ADMIN_ORIGIN:          process.env.ADMIN_ORIGIN
                             ? process.env.ADMIN_ORIGIN.split(',').map((o) => o.trim())
                             : null,
  }

  return _config
}

/**
 * Return the cached config. `loadConfig()` must have been called first (done in server.ts).
 * Lib files and plugins use this instead of reading process.env directly.
 */
export function getConfig(): Config {
  if (!_config) return loadConfig()
  return _config
}

/** Drop a trailing slash so URL comparisons match the auth-message convention. */
function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s
}
