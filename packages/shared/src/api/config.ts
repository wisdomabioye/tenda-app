export const apiConfig = {
  development: {
    baseUrl: 'http://localhost:3000',
    timeout: 5000,
    retries: 0,
  },
  staging: {
    baseUrl: 'https://staging-api.tenda.com',
    timeout: 10000,
    retries: 2,
  },
  production: {
    baseUrl: 'https://api.tenda.com',
    timeout: 15000,
    retries: 3,
  },
} as const

export type AppEnv = keyof typeof apiConfig
export type ApiConfig = (typeof apiConfig)[AppEnv]
