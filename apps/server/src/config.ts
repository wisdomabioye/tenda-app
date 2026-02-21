const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'SOLANA_RPC_URL',
] as const

export interface Config {
  DATABASE_URL: string
  JWT_SECRET: string
  CLOUDINARY_CLOUD_NAME: string
  CLOUDINARY_API_KEY: string
  CLOUDINARY_API_SECRET: string
  SOLANA_RPC_URL: string
  // Optional — defaults applied at read time
  PLATFORM_FEE_BPS: number   // basis points, e.g. 250 = 2.5%
  SOLANA_PROGRAM_ID: string
}

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

  return {
    DATABASE_URL:            process.env.DATABASE_URL!,
    JWT_SECRET:              process.env.JWT_SECRET!,
    CLOUDINARY_CLOUD_NAME:   process.env.CLOUDINARY_CLOUD_NAME!,
    CLOUDINARY_API_KEY:      process.env.CLOUDINARY_API_KEY!,
    CLOUDINARY_API_SECRET:   process.env.CLOUDINARY_API_SECRET!,
    SOLANA_RPC_URL:          process.env.SOLANA_RPC_URL!,
    PLATFORM_FEE_BPS:        Number(process.env.PLATFORM_FEE_BPS  ?? 250),
    SOLANA_PROGRAM_ID:       process.env.SOLANA_PROGRAM_ID ?? 'TendaEscrowProgram1111111111111111111111111',
  }
}
