/**
 * MetaMask via `@metamask/connect-multichain` — the React-Native-supported
 * MetaMask Connect package (it ships a real `react-native` build with a
 * relay-WebSocket + deeplink transport, per MetaMask's RN quickstart).
 *
 * History / why this package: the prior `@metamask/connect-evm` (W2, #36) was a
 * BROWSER-ONLY build (`dist/browser` is its sole bundle, no `react-native`
 * entry). On RN it could SEND the request deeplink (via our `preferredOpenLink`
 * hook) but had no way to RECEIVE MetaMask's response — that path is browser
 * redirect/window only. Root-caused on-device 2026-06-23: connect succeeded,
 * every `personal_sign` hung on MetaMask's splash and ended in
 * `Failed to resume session: Resume timeout` (no return deeplink ever arrived).
 * `connect-multichain` receives the response over its relay, so signing
 * completes. Metro already maps the Node-builtin stubs this package needs.
 *
 * Session model: `connect()` authorizes ONE multichain session across our EVM
 * scopes; sign/send then ride `invokeMethod({ scope, request })` on that session
 * (no per-call `switchChain`). Read calls (receipt) are served from
 * `api.supportedNetworks` RPC, so they don't wake the wallet. EVM ONLY — Solana
 * stays on MWA (Android) / Phantom (iOS).
 *
 * ⚠ #68: needs on-device verification with MetaMask Mobile (connect AND sign);
 * the deeplink/relay round-trips can't run in CI or a simulator.
 */
import { Linking } from 'react-native'
import { Buffer } from 'buffer'
import {
  createMultichainClient,
  isRejectionError,
  type MultichainCore,
  type RpcUrlsMap,
  type Scope,
} from '@metamask/connect-multichain'
import { WalletError } from '@/wallet/errors'
import { canOpenScheme } from './detect'
import { connectThenSign } from './connect-then-sign'
import { metadata, WALLET_CHAINS } from '../config'
import type { SignMessageResult, SpikeAccount } from '../types'
import type { AuthenticateResult, WalletAdapter } from './types'

// CAIP-2 EVM scopes we support → read RPC endpoints. `connect()` authorizes all
// of them in one session, so sign/send can target any by scope without a
// separate switch hop. Public, no-key endpoints — swap for Alchemy/Infura in
// production. `supportedNetworks` also routes the SDK's read RPC (receipts).
const SUPPORTED_NETWORKS: RpcUrlsMap = {
  'eip155:1': 'https://cloudflare-eth.com',
  'eip155:8453': 'https://mainnet.base.org', // Base
  'eip155:84532': 'https://sepolia.base.org', // Base Sepolia
  'eip155:42220': 'https://forno.celo.org', // CELO
}
const EVM_SCOPES = Object.keys(SUPPORTED_NETWORKS) as Scope[]

/** A CAIP-2 scope ('eip155:8453'), defaulting to our configured primary chain. */
function asScope(chainId: string | undefined): Scope {
  return (chainId && chainId.startsWith('eip155:') ? chainId : WALLET_CHAINS.eip155) as Scope
}

/** A transport timeout — `TransportTimeoutError`, or the `RPCErr53` whose
 *  message carries "Transport request timed out". MetaMask received the request
 *  but never answered (e.g. it hung without rendering the approval sheet). */
function isTransportTimeout(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { name?: unknown; message?: unknown }
  return (
    e.name === 'TransportTimeoutError' ||
    (typeof e.message === 'string' && e.message.includes('Transport request timed out'))
  )
}

/**
 * Runs a wallet op and normalises its failures:
 *  - a decline → typed `WalletError('declined')` (connectThenSign maps it to
 *    `null` instead of a hard error);
 *  - a transport timeout → tear the session down before rethrowing, so the NEXT
 *    attempt reconnects cleanly instead of hitting MetaMask's "Existing
 *    connection is pending" — a wedged session that otherwise needs an app
 *    restart. The timeout still surfaces so the screen shows the failure.
 */
async function runWalletOp<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op()
  } catch (err) {
    if (isRejectionError(err)) {
      throw new WalletError('declined', 'Wallet request declined', err)
    }
    if (isTransportTimeout(err)) {
      try {
        const client = await getClient()
        await client.disconnect()
      } catch {
        // Best-effort reset — clearing the wedged session is what matters; the
        // original timeout is what we rethrow.
      }
    }
    throw err
  }
}

let clientPromise: Promise<MultichainCore> | null = null

function getClient(): Promise<MultichainCore> {
  if (!clientPromise) {
    clientPromise = createMultichainClient({
      dapp: { name: metadata.name, url: metadata.url, iconUrl: metadata.iconUrl },
      api: { supportedNetworks: SUPPORTED_NETWORKS },
      mobile: {
        // RN uses the `metamask://` deeplink (not the https universal link).
        useDeeplink: true,
        preferredOpenLink: (deeplink: string) => {
          if (__DEV__) console.log('[metamask] openLink', deeplink)
          void Linking.openURL(deeplink)
        },
      },
      debug: __DEV__,
    })
  }
  return clientPromise
}

/** CAIP-10 ('eip155:8453:0xADDR') → SpikeAccount. */
function toSpikeAccount(caipAccountId: string): SpikeAccount {
  const [namespace, reference, address] = caipAccountId.split(':')
  return {
    namespace: 'eip155',
    chainId: `${namespace}:${reference}`,
    address: address ?? '',
    walletId: 'metamask',
  }
}

/** First authorized account from the live session, preferring the primary chain. */
async function firstAuthorizedAccount(client: MultichainCore): Promise<SpikeAccount | null> {
  const session = await client.provider.getSession()
  if (!session) return null
  const scopes = Object.entries(session.sessionScopes)
  const primary = scopes.find(([scope]) => scope === WALLET_CHAINS.eip155)?.[1]?.accounts?.[0]
  if (primary !== undefined) return toSpikeAccount(primary)
  for (const [, scopeObject] of scopes) {
    const account = scopeObject.accounts?.[0]
    if (account !== undefined) return toSpikeAccount(account)
  }
  return null
}

async function connect(): Promise<SpikeAccount> {
  if (!(await canOpenScheme('metamask'))) {
    throw new Error('MetaMask is not installed on this device')
  }
  const client = await getClient()
  await runWalletOp(() => client.connect(EVM_SCOPES, []))
  const account = await firstAuthorizedAccount(client)
  if (account === null) throw new Error('MetaMask did not return an account')
  return account
}

function hexMessage(message: string): string {
  return '0x' + Buffer.from(message, 'utf8').toString('hex')
}

async function signMessage(account: SpikeAccount, message: string): Promise<SignMessageResult> {
  const client = await getClient()
  const result = await runWalletOp(() =>
    client.invokeMethod({
      scope: asScope(account.chainId),
      request: { method: 'personal_sign', params: [hexMessage(message), account.address] },
    }),
  )
  if (typeof result !== 'string') throw new Error('MetaMask returned a non-string signature')
  return { signature: result, message }
}

function authenticate(
  buildMessage: (account: SpikeAccount) => string,
  opts?: { forceFresh?: boolean },
): Promise<AuthenticateResult | null> {
  return connectThenSign({ connect, signMessage, disconnect }, buildMessage, opts)
}

async function disconnect(): Promise<void> {
  const client = await getClient()
  // Swallow any disconnect error so the app's local state always gets cleared —
  // if the revoke didn't reach MM, the user can disconnect from MM's own UI.
  try {
    await client.disconnect()
  } catch (err) {
    if (__DEV__) console.warn('[metamask] disconnect non-fatal:', err)
  }
}

async function getRestoredAccount(): Promise<SpikeAccount | null> {
  try {
    const client = await getClient()
    return await firstAuthorizedAccount(client)
  } catch {
    return null
  }
}

/**
 * Send a prepared EVM transaction through the connected MetaMask session
 * (stage-3 § mobile). Targets `input.chainId`'s scope directly (it's already in
 * the authorized session). `feeCurrency` rides along for CELO — wallets that
 * support it show gas in cUSD; others ignore it. Returns the tx hash.
 */
export async function sendEvmTransaction(input: {
  from: string
  to: string
  data: string
  /** Decimal string (wei). */
  value: string
  /** CAIP-2 ('eip155:8453') — the scope the tx is sent on. */
  chainId?: string
  feeCurrency?: string
}): Promise<string> {
  const client = await getClient()
  const result = await runWalletOp(() =>
    client.invokeMethod({
      scope: asScope(input.chainId),
      request: {
        method: 'eth_sendTransaction',
        params: [
          {
            from: input.from,
            to: input.to,
            data: input.data,
            value: `0x${BigInt(input.value).toString(16)}`,
            ...(input.feeCurrency !== undefined ? { feeCurrency: input.feeCurrency } : {}),
          },
        ],
      },
    }),
  )
  if (typeof result !== 'string') throw new Error('MetaMask returned a non-string tx hash')
  return result
}

/**
 * EVM receipt poll for TransactionMonitor's RPC fallback (CO3). Served from the
 * `supportedNetworks` RPC (no wallet round-trip). `status` is '0x1' on success,
 * '0x0' on revert; a missing receipt means still pending. Queries the primary
 * EVM scope — sufficient for the common case; a cross-chain receipt would need
 * the caller to thread the chain through (the signature predates multichain).
 */
export async function getEvmTransactionStatus(
  tx_hash: string,
): Promise<'confirmed' | 'failed' | 'not_found'> {
  const client = await getClient()
  const receipt = await client.invokeMethod({
    scope: asScope(undefined),
    request: { method: 'eth_getTransactionReceipt', params: [tx_hash] },
  })
  if (receipt === null || receipt === undefined) return 'not_found'
  const status = (receipt as { status?: string }).status
  if (status === '0x1') return 'confirmed'
  if (status === '0x0') return 'failed'
  return 'not_found'
}

export const metamaskAdapter: WalletAdapter = {
  id: 'metamask',
  name: 'MetaMask',
  iconSource: require('@/assets/wallets/metamask.png'),
  namespaces: ['eip155'],
  isAvailable: async () => true,
  isInstalled: () => canOpenScheme('metamask'),
  connect,
  signMessage,
  authenticate,
  disconnect,
  getRestoredAccount,
}
