/**
 * Status (2026-05-13): connect works end-to-end; sign DOES NOT — MM Mobile
 * opens on the `metamask://connect/mwp?id=<sessionId>` deeplink but the
 * approval sheet never renders, then `client.invokeMethod` times out with
 * `RPC client invoke method reason (transport request timed out)`.
 *
 * We've matched the official RN quickstart and sign guide verbatim:
 *   https://docs.metamask.io/metamask-connect/multichain/quickstart/react-native/
 *   https://docs.metamask.io/metamask-connect/multichain/guides/sign-transactions/
 * Polyfills, metro config, `client.invokeMethod` (not provider), params shape,
 * scope format — all correct per docs. The gap is in MM's RN sign flow: SDK
 * fires the wake-up deeplink with only a session id, MM foregrounds but
 * doesn't find the pending RPC in time to surface the sheet.
 *
 * BASE / CELO support depends on getting EVM signing working here. Next move
 * to try: swap `@metamask/connect-multichain` for `@metamask/connect-evm`
 * (EVM-only client, smaller surface, possibly different RN transport).
 *   https://docs.metamask.io/metamask-connect/evm/quickstart/react-native/
 * If `connect-evm` also fails to render the sign sheet on RN, file an issue
 * with MetaMask and reconsider the strategy.
 */
import { Linking } from 'react-native'
import { Buffer } from 'buffer'
import {
  createMultichainClient,
  type MultichainCore,
} from '@metamask/connect-multichain'
import { canOpenScheme } from './detect'
import { metadata, SPIKE_CHAINS } from '../config'
import type { Namespace, SignMessageResult, SpikeAccount } from '../types'
import type { WalletAdapter } from './types'

// We request EVM mainnets alongside our spike chain because MetaMask Mobile's
// CAIP-25 session currently grants mainnet EVMs reliably but tends to drop
// testnets (Base Sepolia) even when the network is enabled in the wallet.
// `readPrimaryAccount` returns whichever EVM scope MM actually granted, so
// the rest of the adapter doesn't need to care which one made it through.
const SCOPES = [
  'eip155:1', // Ethereum mainnet — universal grant
  'eip155:8453', // Base mainnet
  SPIKE_CHAINS.eip155, // env-driven (Base or Base Sepolia)
  SPIKE_CHAINS.solana,
]

// Public, no-key RPC endpoints — good enough for the spike. Swap for
// Alchemy/Helius/QuickNode in production for rate limits and reliability.
const SUPPORTED_NETWORKS: Record<string, string> = {
  'eip155:1': 'https://cloudflare-eth.com',
  'eip155:8453': 'https://mainnet.base.org',
  'eip155:84532': 'https://sepolia.base.org',
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 'https://api.mainnet-beta.solana.com',
}

let clientPromise: Promise<MultichainCore> | null = null

function getClient(): Promise<MultichainCore> {
  if (!clientPromise) {
    clientPromise = createMultichainClient({
      dapp: {
        name: metadata.name,
        url: metadata.url,
        iconUrl: metadata.iconUrl,
      },
      api: { supportedNetworks: SUPPORTED_NETWORKS },
      mobile: {
        preferredOpenLink: (deeplink: string) => {
          if (__DEV__) console.log('[metamask] openLink', deeplink)
          void Linking.openURL(deeplink)
        },
      },
      // Documented since 0.5.3 — emits console.debug from MWPTransport /
      // RequestRouter so we can see exactly which stage the sign request
      // reaches before the transport times out. Dev-only.
      debug: __DEV__,
    })
  }
  return clientPromise
}

function extractAddress(caip: string): string | null {
  // CAIP-10 account ids are `<ns>:<ref>:<address>`; address is the last
  // colon-separated segment. Reading it this way also tolerates wallets that
  // return slightly off-spec CAIPs (e.g. extra ref segments).
  const idx = caip.lastIndexOf(':')
  if (idx < 0 || idx === caip.length - 1) return null
  return caip.slice(idx + 1)
}

function namespaceOf(scope: string): Namespace | null {
  if (scope.startsWith('eip155:')) return 'eip155'
  if (scope.startsWith('solana:')) return 'solana'
  return null
}

/**
 * MM Connect can grant multiple scopes in one session. We iterate the session's
 * **actual** granted scopes (not the ones we requested — MM may rename or drop
 * a scope silently) and prefer EVM as the primary, falling back to Solana. The
 * exact scope key from the session is stored on `SpikeAccount.chainId` so
 * later `invokeMethod` calls match what the wallet has authorised.
 */
async function readPrimaryAccount(client: MultichainCore): Promise<SpikeAccount | null> {
  const session = await client.provider.getSession()
  if (!session) return null
  const entries = Object.entries(session.sessionScopes)
  if (__DEV__) {
    console.log(
      '[metamask] granted scopes:',
      entries.map(([s, o]) => `${s} (${o.accounts?.length ?? 0} acc)`),
    )
  }
  for (const ns of ['eip155', 'solana'] as const) {
    const hit = entries.find(
      ([scope, obj]) => namespaceOf(scope) === ns && (obj.accounts?.length ?? 0) > 0,
    )
    if (!hit) continue
    const [scope, obj] = hit
    const caip = obj.accounts?.[0]
    if (!caip) continue
    const address = extractAddress(caip)
    if (!address) continue
    return { namespace: ns, chainId: scope, address, walletId: 'metamask' }
  }
  return null
}

async function connect(): Promise<SpikeAccount> {
  if (!(await canOpenScheme('metamask'))) {
    throw new Error('MetaMask is not installed on this device')
  }
  const client = await getClient()
  // @ts-expect-error — MM Connect types Scope as a generic over RPCAPI's known
  // chains; our SPIKE_CHAINS comes from runtime config (env-conditional). The
  // values are valid CAIP-2 ids that MM Connect supports.
  await client.connect(SCOPES, [])
  const account = await readPrimaryAccount(client)
  if (!account) throw new Error('MetaMask did not return an account')
  return account
}

async function signMessage(
  account: SpikeAccount,
  message: string,
): Promise<SignMessageResult> {
  const client = await getClient()
  if (account.namespace === 'eip155') {
    const hex = '0x' + Buffer.from(message, 'utf8').toString('hex')
    const evmReq = { scope: account.chainId, request: { method: 'personal_sign', params: [hex, account.address] } }
    // @ts-expect-error — MM Connect narrows invokeMethod's method/params per
    // scope; our (scope, method, params) triple is correct by construction.
    const result: string = await client.invokeMethod(evmReq)
    return { signature: result, message }
  }
  // MM Connect's solana_signMessage expects a **base64**-encoded message —
  // not base58 like WC/Phantom. Wrong encoding silently hangs the request.
  const messageB64 = Buffer.from(message, 'utf8').toString('base64')
  const solReq = { scope: account.chainId, request: { method: 'solana_signMessage', params: { message: messageB64, pubkey: account.address } } }
  // @ts-expect-error — same generic-narrowing limitation as the EVM branch.
  const result: { signature: string } = await client.invokeMethod(solReq)
  return { signature: result.signature, message }
}

async function disconnect(): Promise<void> {
  const client = await getClient()
  // Swallow any disconnect error so the app's local state always gets cleared
  // — if the revoke didn't reach MM, the user can disconnect from MM's own UI.
  try {
    await client.disconnect()
  } catch (err) {
    if (__DEV__) console.warn('[metamask] disconnect non-fatal:', err)
  }
}

async function getRestoredAccount(): Promise<SpikeAccount | null> {
  try {
    const client = await getClient()
    return await readPrimaryAccount(client)
  } catch {
    return null
  }
}

export const metamaskAdapter: WalletAdapter = {
  id: 'metamask',
  name: 'MetaMask',
  iconSource: require('@/assets/wallets/metamask.png'),
  namespaces: ['eip155', 'solana'],
  isAvailable: async () => true,
  isInstalled: () => canOpenScheme('metamask'),
  connect,
  signMessage,
  disconnect,
  getRestoredAccount,
}
