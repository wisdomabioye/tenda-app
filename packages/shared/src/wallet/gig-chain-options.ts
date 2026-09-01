/**
 * Which chains a gig composer may offer, and which one it opens on (#58).
 *
 * ONE owner for both clients. Web and mobile each carried this inline and
 * character-identical, and what shipped gated only EVM:
 *
 *   enabled: c.namespace !== 'eip155' || hasEvmWallet
 *
 * Solana was therefore hardcoded ALWAYS enabled, and the composer's default
 * chain was a constant pointing at it. A fresh account with no wallet at all
 * saw Solana selected and live beside correctly-greyed EVM chips — so the one
 * enabled chip read as *verified*, the form was filled, and the refusal
 * arrived at signing as a 403. A user who had linked only an EVM wallet got
 * the same wall, having done exactly what the UI asked of them.
 *
 * The rule here is the honest one: a chain is offerable when the user holds a
 * verified wallet on ITS namespace, whatever that namespace is.
 *
 * WHY A `state` AND NOT JUST A BOOLEAN: three different situations disable a
 * chip and they must not read alike. "You have no wallet" is a true statement
 * only in one of them; saying it while the trust list is still loading, or
 * after it FAILED, is the dead end `ApplyWalletPicker` was built to remove.
 * A boolean cannot carry that difference, so it is derived from the state
 * rather than being the source.
 *
 * WHY IT LIVES UNDER wallet/: the question is a wallet-capability one, and
 * this folder already imports `../chains` (see allowance.ts, evm-tx-status.ts)
 * — putting it here adds no new dependency direction between the two.
 */

import type { LinkedWallet } from '../api/contracts/auth.contract'
import type { ChainRegistryEntry } from '../api/contracts/platform.contract'
import { gigAssetByChain } from '../chains'
import { verifiedWalletsOn } from './wallet-address'
import type { WalletsStatus } from './section-state'

/**
 * Why a chain is or isn't offerable. `needs_wallet` is the only one that may
 * be phrased as "link a wallet" — the other two are statements about our own
 * loading, not about what the user has.
 */
export type ChainOptionState = 'ready' | 'needs_wallet' | 'wallets_loading' | 'wallets_unavailable'

/**
 * The parenthetical a picker appends to a disabled chip, or null when the
 * chip needs none. SHARED so web and mobile cannot describe the same state
 * differently — a chain called "loading" on one client and "link a wallet" on
 * the other is the drift #58 exists to end.
 */
const CHAIN_OPTION_NOTE: Record<ChainOptionState, string | null> = {
  ready: null,
  needs_wallet: '(link a wallet)',
  wallets_loading: '(checking wallets)',
  wallets_unavailable: '(wallets unavailable)',
}

export interface GigChainOption {
  id: string
  label: string
  state: ChainOptionState
  /** Derived, never set independently: `state === 'ready'`. */
  enabled: boolean
}

/**
 * What a chip reads: the chain's name, plus WHY it cannot be picked when it
 * cannot. Composed here rather than in each picker — web and mobile render
 * with different primitives but say the same sentence, and a per-client copy
 * of this two-line rule is how the two labels drift apart. That is the same
 * shape of duplication #58 was filed for.
 */
export function chainOptionLabel(option: GigChainOption): string {
  const note = CHAIN_OPTION_NOTE[option.state]
  return note === null ? option.label : `${option.label} ${note}`
}

/**
 * Registry chains that carry gigs, each tagged with whether this user can
 * actually sign on it.
 *
 * Eligibility is unchanged and still policy-derived: the shared
 * `gigAssetByChain` names the chain's gig asset, and the registry must
 * actually carry that asset (the server 400s a chain it doesn't run, so the
 * manifest alone is not enough).
 */
export function gigChainOptions(args: {
  registry: readonly ChainRegistryEntry[]
  wallets: readonly LinkedWallet[]
  walletsStatus: WalletsStatus
}): GigChainOption[] {
  const { registry, wallets, walletsStatus } = args
  return registry
    .filter((c) => {
      const gigAsset = gigAssetByChain(c.id)
      return gigAsset !== null && c.assets.some((a) => a.id === gigAsset)
    })
    .map((c) => {
      const state = chainOptionState(c.namespace, wallets, walletsStatus)
      return { id: c.id, label: c.display_name, state, enabled: state === 'ready' }
    })
}

function chainOptionState(
  namespace: ChainRegistryEntry['namespace'],
  wallets: readonly LinkedWallet[],
  walletsStatus: WalletsStatus,
): ChainOptionState {
  // A wallet in hand answers the question outright. Checked BEFORE the status
  // so a stale or never-refreshed status cannot hide a wallet the caller can
  // already see — the list is the trust source, the status only explains its
  // absence.
  if (verifiedWalletsOn(namespace, wallets).length > 0) return 'ready'
  if (walletsStatus === 'error') return 'wallets_unavailable'
  // ONLY an explicit 'ready' may produce "you have no wallet". 'idle' means
  // nobody has asked yet, which reads the same as in-flight to anyone looking
  // at the screen, and a caller that omits the status entirely is likewise
  // telling us nothing — a real case, caught by web's wizard test whose store
  // mock had no walletsStatus at all. Defaulting the unknown to "no wallet"
  // puts the one message that must be EARNED on the screen for free.
  if (walletsStatus !== 'ready') return 'wallets_loading'
  return 'needs_wallet'
}

/**
 * The chain a composer should open on: the first the user can actually sign
 * on, else `fallback`.
 *
 * Callers DERIVE their selection from this during render rather than syncing
 * it into state from an effect: the registry and the wallet list both land
 * after first paint, and a `useState` seeded at mount cannot see either. An
 * effect that wrote the answer back would also be a setState-in-effect, which
 * the lint rule rejects for exactly this reason.
 *
 * The fallback is the caller's configured default and is deliberately still
 * returned when nothing is ready — a composer has to start somewhere, and
 * with no wallet at all every option is disabled anyway, so the selection is
 * inert until one is linked. What it must NOT do is what the old constant
 * did: leave a user who linked one namespace pointed at another.
 */
export function defaultGigChainId(options: readonly GigChainOption[], fallback: string): string {
  return options.find((o) => o.enabled)?.id ?? fallback
}
