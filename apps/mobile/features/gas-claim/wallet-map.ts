/**
 * Which wallet each chain would pay, derived from the balances the wallet
 * screen already holds.
 *
 * Its own module so the screen stays a placement and nothing else: the mapping
 * is a fact about this feature ("the address the grant lands in"), not about
 * the balances list, and putting it inline in the screen would be the first
 * piece of gas-claim logic to leak out of the directory.
 *
 * FIRST wallet per chain wins. A user may hold several on one chain and the
 * server pays the one `resolvePrimaryWalletAddress` picks — which this cannot
 * re-derive without duplicating that rule, so it shows the address the same
 * row above it shows. When they differ, the honest fix is the server telling
 * the client which wallet it chose, not a second guess here.
 */
import type { WalletChainBalance } from '@tenda/shared'

export function gasClaimWalletByChain(
  balances: readonly WalletChainBalance[],
): Readonly<Record<string, string>> {
  const byChain: Record<string, string> = {}
  for (const b of balances) {
    if (!Object.hasOwn(byChain, b.chainId)) byChain[b.chainId] = b.address
  }
  return byChain
}
