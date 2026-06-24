/**
 * Wallet error taxonomy — a standalone module so pure consumers (the auth
 * composer, adapters, tests) can import the type WITHOUT pulling the
 * native-heavy wallet barrel (`index.ts` constructs a @solana/web3.js
 * Connection and re-exports the WalletConnect adapter's EVM helpers).
 */
export type WalletErrorCode = 'no_wallet' | 'declined' | 'network' | 'unknown'

export class WalletError extends Error {
  constructor(
    public readonly code: WalletErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'WalletError'
  }
}
