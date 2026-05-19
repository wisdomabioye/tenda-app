import { metamaskAdapter } from './metamask'
import { phantomAdapter } from './phantom'
import { solanaMwaAdapter } from './solana-mwa'
import type { WalletAdapter } from './types'

/**
 * Picker display order. Per-platform availability is enforced by each
 * adapter's `isAvailable()` so the picker shows only entries with a real
 * transport on the current device:
 *
 *   • Android → MetaMask, Solana Wallet (MWA — OS picks Phantom/Solflare/etc.)
 *   • iOS     → MetaMask, Phantom (universal links, pending impl)
 *
 * The split mirrors the actual transport landscape: MWA on Android is
 * wallet-agnostic by design (no targeting API), but iOS uses each wallet's
 * own universal-link protocol — so iOS gets per-wallet picker entries while
 * Android gets one generic Solana entry.
 */
export const adapters: readonly WalletAdapter[] = [
  metamaskAdapter,
  solanaMwaAdapter,
  phantomAdapter,
]

export function findAdapter(id: string): WalletAdapter | undefined {
  return adapters.find((a) => a.id === id)
}

export function requireAdapter(id: string): WalletAdapter {
  const adapter = findAdapter(id)
  if (!adapter) throw new Error(`No adapter registered for wallet "${id}"`)
  return adapter
}
