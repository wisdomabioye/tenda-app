import { WalletError } from '@tenda/shared'

export async function approveNativeGasFallback(
  ensureChain: () => Promise<void>,
): Promise<void> {
  if (!window.confirm('Your wallet requires CELO for network fees. Continue using CELO?')) {
    throw new WalletError('declined', 'CELO network fee payment was declined')
  }
  await ensureChain()
}
