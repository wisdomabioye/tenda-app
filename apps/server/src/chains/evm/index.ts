/**
 * EVM ChainAdapter (stage-3-base.md) — viem-backed, generic across EVM
 * chains: BASE here, CELO in Stage 4 (same adapter, different
 * EvmAdapterArgs). Slots into the Stage-0 registry beside the Solana
 * adapter; verify-tx, reconcile and the routes are untouched.
 *
 * Sponsorship: when the paymaster is configured AND lib/sponsor.ts says
 * the user qualifies, buildTx returns an `evm-userop` skeleton (calldata +
 * paymaster fields); otherwise a plain `evm-tx`. The reservation /
 * decrement lifecycle stays in lib/sponsor.ts + verify-tx (Stage 0
 * pattern).
 */

import { recoverMessageAddress, toHex } from 'viem'
import { computePlatformFee } from '@server/lib/escrow'
import { bytesToUuid, uuidToBytes } from '@server/chains/ids'
import type {
  AssetId,
  BuildTxArgs,
  ChainAdapter,
  ChainId,
  EscrowState,
  UnsignedTx,
  VerifiedTx,
  VerifyAuthSigArgs,
  VerifyTxArgs,
} from '@server/chains/types'
import { buildEvmCall } from './builders'
import { decodeEscrowLogs } from './verify'
import { createEvmRpc, ZERO_ADDRESS, type EvmRpc } from './rpc'
import { ENTRY_POINT_V06, type PaymasterHttp } from './paymaster'

export interface EvmAdapterDeps {
  /** user_id → the user's EVM wallet address (0x-hex). */
  resolveWalletAddress(user_id: string): Promise<string>
  /** AssetId → ERC-20 address (`null` = native). Throws on unknown. */
  resolveAsset(asset: AssetId): Promise<{ token_address: string | null }>
  /**
   * Should this user's next tx be sponsored? (lib/sponsor.ts policy —
   * remaining quota etc.). Absent = never sponsor.
   */
  shouldSponsor?(user_id: string): Promise<boolean>
  /** Test seam: replace the network-backed RPC with a fake. */
  rpc?: EvmRpc
  /** Paymaster endpoint seam; absent = sponsorship unavailable. */
  paymaster?: PaymasterHttp
}

export interface EvmAdapterArgs {
  /** CAIP-2 id, e.g. `'eip155:8453'`. */
  chain_id: ChainId
  rpc_url: string
  /** Deployed TendaEscrow address on this chain. */
  escrow_contract: `0x${string}`
  /** Reorg safety margin before a receipt counts as confirmed. */
  min_confirmations: number
  /**
   * CELO-style gas abstraction: when set, every plain tx carries
   * `feeCurrency` so the user pays gas in stables (stage-4 final policy:
   * always-on for CELO — no counter, no paymaster).
   */
  fee_currency?: `0x${string}`
  deps: EvmAdapterDeps
}

const EVM_STATUS: ReadonlyArray<EscrowState['status']> = [
  'open',
  'accepted',
  'submitted',
  'completed',
  'cancelled',
  'refunded',
  'disputed',
  'resolved',
]

export function evmAdapter(args: EvmAdapterArgs): ChainAdapter {
  const rpc = args.deps.rpc ?? createEvmRpc({ rpc_url: args.rpc_url })

  async function buildTx(build: BuildTxArgs): Promise<UnsignedTx> {
    const ctx = await buildContext(build)
    const call = buildEvmCall(build, ctx)

    const sponsorable =
      args.deps.paymaster !== undefined &&
      call.value_raw === '0' && // paymasters won't fund msg.value
      (await (args.deps.shouldSponsor?.(build.user_id) ?? Promise.resolve(false)))

    if (sponsorable && args.deps.paymaster !== undefined) {
      const sender = (await args.deps.resolveWalletAddress(build.user_id)) as `0x${string}`
      try {
        const sponsored = await args.deps.paymaster.sponsorUserOperation(
          { sender, call_data: call.data },
          ENTRY_POINT_V06,
        )
        return {
          kind: 'evm-userop',
          entry_point: ENTRY_POINT_V06,
          user_op: {
            sender,
            nonce: '0x0', // bundler-resolved client-side (EOA 4337 flow)
            init_code: '0x',
            call_data: call.data,
            call_gas_limit: sponsored.call_gas_limit,
            verification_gas_limit: sponsored.verification_gas_limit,
            pre_verification_gas: sponsored.pre_verification_gas,
            max_fee_per_gas: '0x0',
            max_priority_fee_per_gas: '0x0',
            paymaster_and_data: sponsored.paymaster_and_data,
            signature: '0x',
          },
        }
      } catch {
        // Documented degradation: sponsorship unavailable → user pays gas
        // (~$0.01 on BASE). Fall through to the plain tx.
      }
    }

    return {
      kind: 'evm-tx',
      to: args.escrow_contract,
      data: call.data,
      value: call.value_raw,
      ...(args.fee_currency !== undefined ? { fee_currency: args.fee_currency } : {}),
    }
  }

  async function buildContext(build: BuildTxArgs) {
    if (build.action === 'createEscrow') {
      const { token_address } = await args.deps.resolveAsset(build.payload.asset)
      const assigned =
        build.payload.assigned_counterparty_user_id !== undefined
          ? await args.deps.resolveWalletAddress(build.payload.assigned_counterparty_user_id)
          : null
      return { asset_address: token_address, assigned_counterparty_address: assigned }
    }
    if (build.action === 'disputeEscrow') {
      // Bond denomination follows the escrow's asset — read it on-chain so
      // the value rule can't drift from contract state.
      const state = await fetchEscrowState(escrowRefOf(build.payload.escrow_id))
      return {
        asset_address: state?.asset_address ?? null,
        assigned_counterparty_address: null,
      }
    }
    return { asset_address: null, assigned_counterparty_address: null }
  }

  async function verifyTx(tx_ref: string, verify: VerifyTxArgs): Promise<VerifiedTx> {
    const receipt = await rpc.getTransactionReceipt(tx_ref as `0x${string}`)
    if (receipt === null) return { confirmed: false, reason: 'receipt not found' }

    const head = await rpc.getBlockNumber()
    if (head - receipt.block_number < BigInt(args.min_confirmations)) {
      return { confirmed: false, pending: true, reason: 'awaiting confirmations' }
    }
    if (receipt.status !== 'success') {
      return { confirmed: true, failed: true, reason: 'transaction reverted' }
    }

    const events = decodeEscrowLogs(receipt.logs, args.escrow_contract, args.chain_id)
    const match =
      verify.expected_event !== undefined
        ? events.find((e) => e.name === verify.expected_event)
        : events[0]
    if (match === undefined) {
      return {
        confirmed: true,
        failed: true,
        reason:
          verify.expected_event !== undefined
            ? `expected event ${verify.expected_event} not found`
            : 'no escrow event in transaction',
      }
    }
    if (verify.escrow_id !== undefined && match.fields.escrow_id_uuid !== verify.escrow_id) {
      return { confirmed: true, failed: true, reason: 'escrow_id mismatch' }
    }
    return { confirmed: true, failed: false, event: match }
  }

  function escrowRefOf(escrow_id_uuid: string): string {
    return toHex(uuidToBytes(escrow_id_uuid))
  }

  async function fetchEscrowState(escrow_ref: string): Promise<EscrowState | null> {
    const tuple = await rpc.readEscrow(args.escrow_contract, escrow_ref as `0x${string}`)
    if (tuple === null) return null
    const status = EVM_STATUS[tuple.status]
    if (status === undefined) return null // unknown enum value — treat as absent
    return {
      escrow_ref,
      escrow_id: bytesToUuid(Buffer.from(tuple.escrow_id.slice(2), 'hex')),
      kind: tuple.kind === 0 ? 'gig' : 'exchange',
      asset_address: tuple.asset === ZERO_ADDRESS ? null : tuple.asset,
      amount_raw: tuple.amount.toString(),
      creator_address: tuple.creator,
      counterparty_address: tuple.counterparty === ZERO_ADDRESS ? null : tuple.counterparty,
      assigned_counterparty_address:
        tuple.assigned_counterparty === ZERO_ADDRESS ? null : tuple.assigned_counterparty,
      status,
      accept_deadline_unix: Number(tuple.accept_deadline),
      completion_duration_seconds: Number(tuple.completion_duration),
      completion_deadline_unix: Number(tuple.completion_deadline),
      approval_deadline_unix: Number(tuple.approval_deadline),
      dispute_bond_raw: tuple.dispute_bond.toString(),
      is_seeker: tuple.is_seeker,
      // The contract doesn't store creation time; reconciliation uses the
      // EscrowCreated event's block timestamp via the DB row instead.
      created_at_unix: 0,
    }
  }

  async function verifyAuthSig(a: VerifyAuthSigArgs): Promise<boolean> {
    // EOA-only at this stage: pure ECDSA recovery over the EIP-191
    // personal_sign envelope (offline — no RPC). ERC-1271 smart-account
    // signatures land with the smart-account follow-on (stage-3 out of
    // scope note).
    try {
      const recovered = await recoverMessageAddress({
        message: a.message,
        signature: a.signature as `0x${string}`,
      })
      return recovered.toLowerCase() === a.address.toLowerCase()
    } catch {
      return false
    }
  }

  return {
    namespace: 'eip155',
    chain_id: args.chain_id,
    buildTx,
    verifyTx,
    verifyAuthSig,
    fetchEscrowState,
    computeFee: (fee_args) => computePlatformFee(fee_args),
  }
}
