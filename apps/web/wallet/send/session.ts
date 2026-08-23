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
import { WalletError, guardWalletRequest, isLinkedWallet, truncateWallet } from '@tenda/shared'
import type { ChainNamespace, LinkedWallet } from '@tenda/shared'
import type { VersionedTransaction } from '@solana/web3.js'
import { loadWalletRuntime, peekWalletRuntime } from '../runtime'
import {
  settledConnectedAccount,
  waitForConnection,
  type ConnectModal,
} from '../adapters/reown-connect'
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
  /** Namespace-scoped teardown; omitted = every namespace (AppKit semantics). */
  disconnect(namespace?: ChainNamespace): Promise<void>
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

/** The refused-stranger-wallet message, naming the wallets that WOULD work. */
function unlinkedWalletMessage(ns: ChainNamespace, wallets: LinkedWallet[]): string {
  const linked = wallets
    .filter((w) => w.chain_ns === ns && w.verified_at !== null)
    .map((w) => truncateWallet(w.address))
  return linked.length > 0
    ? `Connect one of your linked wallets (${linked.join(', ')}) to sign this transaction`
    : 'Connect one of your linked wallets to sign this transaction'
}

/**
 * The trust check reads wallets[]; running it against a never-loaded registry
 * refused every linked wallet as a stranger (the "wallet needs to be
 * connected even though it's linked" bug). Load-once, deduped — and a load
 * that FAILED must say so rather than mislabel the wallet unlinked.
 */
async function ensureWalletsReady(): Promise<void> {
  await useAuthStore.getState().ensureWallets()
  if (useAuthStore.getState().walletsStatus !== 'ready') {
    throw new WalletError('network', 'Could not load your linked wallets — check your connection and try again')
  }
}

/**
 * Drop this namespace's session and let the user pick a LINKED wallet from
 * the namespace-filtered connect list — the switch primitive both the
 * signing guard (auto-retry on an unlinked live session) and the confirm
 * dialog's "Switch wallet" affordance share. fresh: only a wallet the user
 * actively picks counts, never a restore. Throws the usual typed decline on
 * dismissal, or a no_wallet naming the linked wallets when the pick is a
 * stranger — the caller decides how each surfaces.
 */
export async function switchToLinkedWallet(ns: ChainNamespace): Promise<string> {
  await ensureWalletsReady()
  const modal = await requireTxModal()
  await modal.disconnect(ns)
  const account = await waitForConnection(modal, { namespace: ns, fresh: true })
  const { wallets } = useAuthStore.getState()
  if (!isLinkedWallet(ns, account.address, wallets)) {
    throw new WalletError('no_wallet', unlinkedWalletMessage(ns, wallets))
  }
  return account.address
}

/**
 * Connect-on-demand guard for signing (mobile's ensureEvmSession, per
 * namespace). A linked wallet proves OWNERSHIP; signing needs a LIVE modal
 * session in this tab. When none exists the connect modal opens instead of
 * dead-ending the transaction — namespace-targeted, so a live session on the
 * OTHER namespace can never satisfy it and the wallet list shows only chains
 * the flow can use; a dismissal surfaces as the usual typed decline. The
 * connected wallet must be one the user has LINKED (verified) — a stranger
 * wallet can't act on this account's escrows; a live session with one gets
 * ONE switch attempt (multichain wallets like Phantom hold an EVM session the
 * user may never have linked) before the typed refusal. Returns the live
 * address; dispatch resolves its signer from it (no store slot to sync on
 * web — the modal IS the session source).
 */
export async function ensureSessionOn(ns: ChainNamespace): Promise<string> {
  await ensureWalletsReady()
  const modal = await requireTxModal()
  let address = modal.getAddress(ns)
  if (address === undefined || address === '') {
    // The runtime boots lazily, so this very read may race the adapter's
    // RESTORE of a persisted session — settle it first, or the modal opens
    // at a user who has a session and the restore then races the signing
    // prompt against the wallet list (mobile's tri-state doctrine).
    address = (await settledConnectedAccount(modal, ns))?.address
  }
  if (address === undefined || address === '') {
    await waitForConnection(modal, { namespace: ns })
    address = modal.getAddress(ns)
  }
  if (address === undefined || address === '') {
    throw new WalletError('no_wallet', `No ${NAMESPACE_LABEL[ns]} wallet connected, connect one first`)
  }
  const { wallets } = useAuthStore.getState()
  if (isLinkedWallet(ns, address, wallets)) return address
  try {
    return await switchToLinkedWallet(ns)
  } catch (e) {
    // Dismissing the switch still needs the WHY — the user closed a list
    // they never asked for; name the wallets that would have worked.
    if (e instanceof WalletError && e.code === 'declined') {
      throw new WalletError('no_wallet', unlinkedWalletMessage(ns, wallets))
    }
    throw e
  }
}
