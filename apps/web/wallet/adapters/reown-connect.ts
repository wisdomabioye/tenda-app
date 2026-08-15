/**
 * Imperative connect-wait over the AppKit modal — web's analogue of mobile's
 * `ConnectionSignal`. On web AppKit exposes `subscribeAccount`/`subscribeState`
 * directly on the modal instance (no React bridge needed), so "connect" is:
 * open the modal, resolve on the first connected account in either namespace,
 * and treat a close-without-account as a user decline (typed
 * `WalletError('declined')`, which `connectThenSign` maps to `null`).
 */
import { WalletError } from '@tenda/shared'
import type { ChainNamespace, WalletAccount } from '@tenda/shared'
import { WALLET_CHAINS } from '../config'

export const REOWN_WALLET_ID = 'reown'

/**
 * Budget for the modal to APPEAR (open() awaits an untimed AppKit prefetch —
 * verified: no signal/timeout anywhere in its ApiController — so a black-holed
 * network would otherwise strand "Waiting for wallet…" forever). Generous,
 * because it only covers the opening phase: once the modal is open the user's
 * decision time is deliberately unbounded. Same failure class as mobile's
 * WC request guard, scoped to web's one pre-UI await.
 */
export const MODAL_OPEN_TIMEOUT_MS = 30_000

/**
 * Minimal structural view of the AppKit modal — only what connecting needs.
 * The real `AppKit` instance is assignable to this (same pattern as mobile's
 * `EvmRequestProvider`: no AppKit type import, no casting, and tests fake it
 * without `unknown` gymnastics).
 */
export interface ConnectModal {
  getAddress(namespace: ChainNamespace): string | undefined
  getCaipNetwork(namespace: ChainNamespace): { caipNetworkId?: string } | undefined
  subscribeAccount(callback: () => void, namespace: ChainNamespace): () => void
  subscribeState(callback: (state: { open: boolean }) => void): () => void
  /** AppKit resolves open() with transport-specific extras we never read. */
  open(): Promise<unknown>
}

const NAMESPACES: readonly ChainNamespace[] = ['solana', 'eip155']

/** CAIP-2 id of the namespace's active network, falling back to our canonical chain. */
function caipChainIdOf(modal: ConnectModal, namespace: ChainNamespace): string {
  const id = modal.getCaipNetwork(namespace)?.caipNetworkId
  return typeof id === 'string' && id.includes(':') ? id : WALLET_CHAINS[namespace]
}

/** The connected account in either namespace, or null. Solana wins ties (primary rail). */
export function connectedAccount(modal: ConnectModal): WalletAccount | null {
  for (const namespace of NAMESPACES) {
    const address = modal.getAddress(namespace)
    if (address !== undefined && address !== '') {
      return { namespace, chainId: caipChainIdOf(modal, namespace), address, walletId: REOWN_WALLET_ID }
    }
  }
  return null
}

/**
 * Open the modal and settle on connect or dismissal. Two subtleties, both
 * verified against AppKit's source:
 *
 *  - The close handler re-checks for an account before declaring a decline —
 *    several wallets close the modal in the same tick the account lands.
 *  - `open: false` only means "dismissed" once the modal has actually BEEN
 *    open. AppKit's state proxy also mutates for loading/init changes while
 *    `open()` is still working (it awaits a prefetch, then sets
 *    `loading: true` BEFORE `open: true`), and valtio notifies subscribers
 *    on every one of those — without the `modalWasOpen` gate, that pre-open
 *    `loading` event read as an instant user decline.
 */
export function waitForConnection(modal: ConnectModal): Promise<WalletAccount> {
  return new Promise<WalletAccount>((resolve, reject) => {
    let settled = false
    let modalWasOpen = false
    const unsubscribes: Array<() => void> = []
    // Fires only if the modal never OPENED within the budget; an open modal
    // waits on the user indefinitely (the callback checks modalWasOpen).
    const openTimer = setTimeout(() => {
      if (!modalWasOpen) {
        finish(() =>
          reject(
            new WalletError('timeout', 'The wallet dialog did not open — check your connection and try again'),
          ),
        )
      }
    }, MODAL_OPEN_TIMEOUT_MS)
    function finish(settleFn: () => void): void {
      if (settled) return
      settled = true
      clearTimeout(openTimer)
      for (const unsubscribe of unsubscribes) unsubscribe()
      settleFn()
    }

    for (const namespace of NAMESPACES) {
      unsubscribes.push(
        modal.subscribeAccount(() => {
          const account = connectedAccount(modal)
          if (account !== null) finish(() => resolve(account))
        }, namespace),
      )
    }
    unsubscribes.push(
      modal.subscribeState((state) => {
        if (state.open) {
          modalWasOpen = true
          return
        }
        if (!modalWasOpen) return // pre-open loading/init churn, not a dismissal
        const account = connectedAccount(modal)
        if (account !== null) finish(() => resolve(account))
        else finish(() => reject(new WalletError('declined', 'Wallet connection cancelled')))
      }),
    )

    modal.open().then(
      () => {
        // open() resolving means the modal was presented — even if the
        // open:true event raced past the subscription above, later close
        // events must count as real dismissals.
        modalWasOpen = true
      },
      (cause: unknown) => {
        finish(() => reject(new WalletError('unknown', 'Could not open the wallet modal', cause)))
      },
    )
  })
}
