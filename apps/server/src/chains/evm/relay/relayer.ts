/**
 * The relayer hot wallet's write path on an EVM chain — the ONE place a
 * server-held key signs an escrow transaction. Behind a port so the unit
 * suites drive the relay with a fake and the anvil suite with the real thing.
 *
 * Gas float only: the key never holds escrow funds (createEscrowFor pulls
 * them from the creator by signature), so its exposure is the native balance
 * it pays gas from — the same ops class as the Solana gas-seed wallet.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
  type Chain,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { chainById, nativeCurrencyOf } from '@tenda/shared'
import { evmChainNumericId } from '@tenda/shared'
import { DEFAULT_EVM_RPC_TIMEOUT_MS } from '../rpc'
import { RECEIVE_WITH_AUTHORIZATION_TYPEHASH } from './authorization'

export interface EvmRelayCall {
  to: `0x${string}`
  data: `0x${string}`
}

export interface EvmRelayer {
  readonly address: `0x${string}`
  /**
   * Does this token publish FiatTokenV2's RECEIVE_WITH_AUTHORIZATION_TYPEHASH,
   * and is it the canonical one? A manifest `eip3009` declaration is intent;
   * this is the live fact (the Galileo mock predates its 3009 build).
   */
  supportsReceiveWithAuthorization(token: `0x${string}`): Promise<boolean>
  /** eth_call as the relayer; throws (with the revert reason) on failure. */
  simulate(call: EvmRelayCall): Promise<void>
  /** Sign as the relayer and broadcast; resolves to the tx hash. */
  send(call: EvmRelayCall): Promise<`0x${string}`>
}

const EIP3009_PROBE_ABI = [
  {
    type: 'function',
    name: 'RECEIVE_WITH_AUTHORIZATION_TYPEHASH',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
] as const satisfies Abi

/**
 * The viem `Chain` a wallet client needs, from the manifest entry: the numeric
 * id, the display name and the native currency are the chain's own facts, the
 * RPC is this deployment's secret.
 */
function relayChain(chain_id: string, rpc_url: string): Chain {
  const entry = chainById(chain_id)
  return {
    id: evmChainNumericId(chain_id),
    name: entry.displayName,
    nativeCurrency: nativeCurrencyOf(entry),
    rpcUrls: { default: { http: [rpc_url] } },
  }
}

export function viemEvmRelayer(args: {
  rpc_url: string
  /** CAIP-2 id of a manifest EVM chain, e.g. `'eip155:84532'`. */
  chain_id: string
  /** 0x-hex secp256k1 private key of the hot wallet (CHAIN_<ID>_RELAYER_KEY). */
  private_key: `0x${string}`
  /** Per-call budget; defaults to the read seam's DEFAULT_EVM_RPC_TIMEOUT_MS. */
  timeout_ms?: number
}): EvmRelayer {
  const account = privateKeyToAccount(args.private_key)
  const chain = relayChain(args.chain_id, args.rpc_url)
  const transport = http(args.rpc_url, { timeout: args.timeout_ms ?? DEFAULT_EVM_RPC_TIMEOUT_MS })
  const reader = createPublicClient({ chain, transport })
  const wallet = createWalletClient({ account, chain, transport })
  return {
    address: account.address,
    async supportsReceiveWithAuthorization(token) {
      try {
        const typehash = await reader.readContract({
          address: token,
          abi: EIP3009_PROBE_ABI,
          functionName: 'RECEIVE_WITH_AUTHORIZATION_TYPEHASH',
        })
        return typehash.toLowerCase() === RECEIVE_WITH_AUTHORIZATION_TYPEHASH.toLowerCase()
      } catch {
        return false // no such getter: the token does not implement EIP-3009
      }
    },
    async simulate(call) {
      await reader.call({ account, to: call.to, data: call.data })
    },
    send(call) {
      return wallet.sendTransaction({ to: call.to, data: call.data })
    },
  }
}
