import { findChain } from '../chains/manifest-queries'

export const NATIVE_GAS_COPY = {
  title: 'Pay network fees in CELO',
  message: 'This wallet doesn’t support paying network fees with USDC. You can continue using CELO for the network fee. The transaction amount is unchanged.',
  confirmLabel: 'Continue with CELO',
  feeNote: 'On Celo, Tenda requests USDC for network fees. If your wallet doesn’t support this, you can choose to pay the network fee in CELO instead. Network fees are separate from the transaction amount.',
} as const

export function networkFeeNote(chainId: string | undefined): string | undefined {
  return chainId !== undefined && findChain(chainId)?.feeCurrency === 'USDC_CELO'
    ? NATIVE_GAS_COPY.feeNote : undefined
}
