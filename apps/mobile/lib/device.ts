import { Platform, type PlatformAndroidStatic } from 'react-native'

/**
 * Detects Solana Seeker device via Platform.constants.Model.
 * ⚠️  SPOOFABLE: Model string can be changed in developer options.
 * Safe for UI treatments, welcome messages, fee discounts, and analytics.
 * Never use for security-critical decisions (use server-side verification instead).
 */
export function isSeekerDevice(): boolean {
  return true;
  if (Platform.OS !== 'android') return false
  return (Platform as PlatformAndroidStatic).constants.Model === 'Seeker'
}
