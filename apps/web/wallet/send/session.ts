/**
 * The transaction-signing slice of the AppKit modal, plus the two guards
 * every signing path shares: `guardTxRequest` (the shared request guard with
 * THIS runtime's session teardown bound in) and `ensureSessionOn` (web's
 * connect-on-demand — mobile's ensure-session, generalised per namespace
 * because on web BOTH namespaces ride the same modal).
 *
 * Structural types throughout (S3 doctrine): no AppKit type imports, the
 * real modal satisfies these interfaces, and tests fake them without casts.
 */
import { WalletError, guardWalletRequest, isLinkedWallet } from '@tenda/shared'
import type { ChainNamespace } from '@tenda/shared'
import type { VersionedTransaction } from '@solana/web3.js'
import { loadWalletRuntime, peekWalletRuntime } from '../runtime'
import { waitForConnection, type ConnectModal } from '../adapters/reown-connect'
import { useAuthStore } from '@/stores/auth.store'

/** EIP-1193 request slice of the AppKit EVM provider (mobile's twin). */
export interface EvmRequestProvider {
  request<T = unknown>(args: { method: string; params?: unknown[] }): Promise<T>
}

/** AppKit's Solana provider slice — the transaction signer. */
export interface SolanaTxProvider {
  signTransaction(tx: VersionedTransaction): Promise<VersionedTransaction>
}

/** The modal surface the signing paths drive (the real AppKit satisfies it). */
export interface TxModal extends ConnectModal {
  getProvider<T>(namespace: ChainNamespace): T | undefined
  /**
   * AppKit's network switch: notifies the connected wallet
   * (wallet_switchEthereumChain for EVM) and throws on refusal when
   * `throwOnFailure` is set — source-verified in
   * ChainController.switchActiveNetwork.
   */
  switchNetwork(network: { id: string | number }, opts?: { throwOnFailure?: boolean }): Promise<void>
  disconnect(): Promise<void>
}

/** The booted modal, or a typed no_wallet error when the build has none. */
export async function requireTxModal(): Promise<TxModal> {
  const state = await loadWalletRuntime()
  if (state.status === 'disabled') {
    throw new WalletError('no_wallet', 'Wallet connect is not configured for this build')
  }
  return state.runtime.modal
}

/**
 * Best-effort session teardown for the guard's exits. peek-only: an unbooted
 * runtime holds no session. Dropping the session on timeout/cancel is
 * deliberate (mobile request-guard doctrine): a WC relay that went silent has
 * an irretractable request queued — some wallets stay wedged on it — and for
 * an extension wallet a disconnect merely costs a one-click reconnect.
 */
function dropSession(): Promise<void> {
  const runtime = peekWalletRuntime()
  return runtime === null ? Promise.resolve() : runtime.modal.disconnect()
}

/** The shared guard with this runtime's teardown bound in. */
export function guardTxRequest<T>(pending: Promise<T>): Promise<T> {
  return guardWalletRequest(pending, { disconnect: dropSession })
}

const NAMESPACE_LABEL: Record<ChainNamespace, string> = {
  solana: 'Solana',
  eip155: 'EVM',
}

/**
 * Connect-on-demand guard for signing (mobile's ensureEvmSession, per
 * namespace). A linked wallet proves OWNERSHIP; signing needs a LIVE modal
 * session in this tab. When none exists the connect modal opens instead of
 * dead-ending the transaction; a dismissal surfaces as the usual typed
 * decline. The connected wallet must be one the user has LINKED (verified) —
 * a stranger wallet can't act on this account's escrows. Returns the live
 * address; dispatch resolves its signer from it (no store slot to sync on
 * web — the modal IS the session source).
 */
export async function ensureSessionOn(ns: ChainNamespace): Promise<string> {
  const modal = await requireTxModal()
  let address = modal.getAddress(ns)
  if (address === undefined || address === '') {
    await waitForConnection(modal)
    address = modal.getAddress(ns)
  }
  if (address === undefined || address === '') {
    throw new WalletError('no_wallet', `No ${NAMESPACE_LABEL[ns]} wallet connected, connect one first`)
  }
  if (!isLinkedWallet(ns, address, useAuthStore.getState().wallets)) {
    throw new WalletError('no_wallet', 'Connect one of your linked wallets to sign this transaction')
  }
  return address
}
