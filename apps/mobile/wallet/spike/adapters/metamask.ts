/**
 * MetaMask via `@metamask/connect-evm` (W2 retry, #36).
 *
 * History: `@metamask/connect-multichain` connected fine but EVERY
 * separate `invokeMethod` sign call timed out on RN — MM Mobile woke on
 * the `metamask://connect/mwp?id=` deeplink but never rendered the
 * approval sheet (open_issues.md W2). This rewrite switches to the
 * EVM-only client whose `connectWith`/`connectAndSign` primitives carry
 * the RPC INSIDE the connection round-trip — the one deeplink flow that
 * did reliably render MM's UI.
 *
 * Sign strategy:
 *   1. `provider.request(personal_sign)` on the live session (fast path —
 *      no extra wallet hop if MM's transport behaves).
 *   2. On timeout, fall back to `connectWith(personal_sign)` which rides
 *      the connect deeplink end-to-end.
 *
 * Scope change vs the multichain adapter: EVM ONLY. Solana is owned by
 * MWA (Android) and the Phantom universal-link adapter (iOS) — MM-Solana
 * was a bonus the broken transport never delivered anyway.
 *
 * ⚠ W2 (#36): needs verification on a physical device with MM Mobile —
 * the deeplink round-trips cannot run in CI or a simulator.
 */
import { Linking } from 'react-native'
import { Buffer } from 'buffer'
import { createEVMClient, type MetamaskConnectEVM, type Hex } from '@metamask/connect-evm'
import { canOpenScheme } from './detect'
import { metadata, SPIKE_CHAINS } from '../config'
import type { SignMessageResult, SpikeAccount } from '../types'
import type { WalletAdapter } from './types'

/** Active EVM chain as hex (SPIKE_CHAINS is CAIP-2: 'eip155:<decimal>'). */
function spikeChainHex(): Hex {
  const decimal = Number(SPIKE_CHAINS.eip155.split(':')[1])
  return `0x${decimal.toString(16)}` as Hex
}

// Public, no-key RPC endpoints for read-only calls — good enough for the
// spike. Swap for Alchemy/QuickNode in production.
const SUPPORTED_NETWORKS: Record<Hex, string> = {
  '0x1': 'https://cloudflare-eth.com',
  '0x2105': 'https://mainnet.base.org', // Base (8453)
  '0x14a34': 'https://sepolia.base.org', // Base Sepolia (84532)
}

let clientPromise: Promise<MetamaskConnectEVM> | null = null

function getClient(): Promise<MetamaskConnectEVM> {
  if (!clientPromise) {
    clientPromise = createEVMClient({
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
      debug: __DEV__,
    })
  }
  return clientPromise
}

function toSpikeAccount(address: string, chainHex: Hex): SpikeAccount {
  return {
    namespace: 'eip155',
    chainId: `eip155:${parseInt(chainHex, 16)}`,
    address,
    walletId: 'metamask',
  }
}

async function connect(): Promise<SpikeAccount> {
  if (!(await canOpenScheme('metamask'))) {
    throw new Error('MetaMask is not installed on this device')
  }
  const client = await getClient()
  const { accounts, chainId } = await client.connect({ chainIds: [spikeChainHex()] })
  const address = accounts[0]
  if (address === undefined) throw new Error('MetaMask did not return an account')
  return toSpikeAccount(address, chainId)
}

function hexMessage(message: string): string {
  return '0x' + Buffer.from(message, 'utf8').toString('hex')
}

async function signMessage(account: SpikeAccount, message: string): Promise<SignMessageResult> {
  const client = await getClient()
  const hex = hexMessage(message)

  // Fast path: sign on the live session.
  try {
    const result = await client.getProvider().request({
      method: 'personal_sign',
      params: [hex, account.address],
    })
    if (typeof result !== 'string') throw new Error('MetaMask returned a non-string signature')
    return { signature: result, message }
  } catch (err) {
    if (__DEV__) console.warn('[metamask] personal_sign on session failed, retrying via connectWith:', err)
  }

  // W2 fallback: ride the connect deeplink — the flow whose approval UI
  // reliably renders on MM Mobile RN.
  const { result } = await client.connectWith({
    method: 'personal_sign',
    params: (addr) => [hex, addr],
    chainIds: [spikeChainHex()],
    account: account.address,
  })
  if (typeof result !== 'string') throw new Error('MetaMask returned a non-string signature')
  return { signature: result, message }
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
    const address = client.selectedAccount
    const chainId = client.selectedChainId
    if (address === undefined) return null
    return toSpikeAccount(address, chainId ?? spikeChainHex())
  } catch {
    return null
  }
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
  disconnect,
  getRestoredAccount,
}
