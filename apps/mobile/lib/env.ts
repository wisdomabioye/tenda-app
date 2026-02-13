import Constants from 'expo-constants'
import type { AppEnv } from '@tenda/shared'

export function getEnv(): AppEnv {
  const env = Constants.expoConfig?.extra?.APP_ENV
  if (env === 'staging' || env === 'production') return env
  return 'development'
}
