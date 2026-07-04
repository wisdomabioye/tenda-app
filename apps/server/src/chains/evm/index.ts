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

import { isAddress, toHex } from 'viem'
import { chainById, ErrorCode, ESCROW_STATUS_ORDER, type PermitPayloadResponse } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { computePlatformFee } from '@server/lib/escrow'
import { verifyWalletSignature } from '@server/lib/wallet-signature'
import { bytesToUuid, uuidToBytes } from '@server/chains/ids'
import {
  isAmountRaw,
  type AmountRaw,
  type AssetId,
  type BuildTxArgs,
  type ChainAdapter,
  type ChainId,
  type EscrowState,
  type UnsignedTx,
  type VerifiedTx,
  type VerifyAuthSigArgs,
  type VerifyTxArgs,
} from '@server/chains/types'
import { buildEvmCall } from './builders'
import { decodeEscrowLogs } from './verify'
import { createEvmRpc, ZERO_ADDRESS, type EvmRpc } from './rpc'
import {
  buildPermitTypedData,
  evmNumericChainId,
  PERMIT_DEADLINE_SECONDS,
  permitDomainMatches,
} from './permit'
import { ENTRY_POINT_V06, type PaymasterHttp } from './paymaster'

export interface EvmAdapterDeps {
  /** user_id → the user's EVM wallet address (0x-hex). */
  resolveWalletAddress(user_id: string): Promise<string>
  /** AssetId → ERC-20 address (`null` = native). Throws on unknown. */
  resolveAsset(asset: AssetId): Promise<{ token_address: string | null }>
  /**
   * Should this user's next tx be sponsored? (lib/sponsor.ts policy —
   * remaining quota etc.). A `true` result has ALREADY reserved (decremented)
   * a quota slot — see `releaseSponsorship`. Absent = never sponsor.
   */
  shouldSponsor?(user_id: string): Promise<boolean>
  /**
   * Give back a quota slot reserved by `shouldSponsor` when the sponsored
   * build fails after reservation (paymaster outage / wallet-resolution
   * error). Without it the reserved slot leaks — the user loses a free tx
   * yet pays gas. Absent = no-op (chains that never reserve, e.g. CELO).
   */
  releaseSponsorship?(user_id: string): Promise<void>
  /**
   * Is `address` one of the user's VERIFIED linked eip155 wallets? Gates
   * permit-payload building: the permit's owner must be an account the
   * caller actually controls (and will send from). Absent = permit payloads
   * unavailable on this adapter instance.
   */
  verifyWalletOwnership?(user_id: string, address: string): Promise<boolean>
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

// On-chain status enum → wire status, indexed by the contract's uint8. Sourced
// from the single shared order (guarded against both contracts by
// check-contract-parity) so a contract enum reorder can't silently mis-decode.
const EVM_STATUS: ReadonlyArray<EscrowState['status']> = ESCROW_STATUS_ORDER

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
      // A quota slot was reserved in shouldSponsor(). EVERY exit from here on
      // must either keep it (sponsored build succeeds) or release it (any
      // failure → plain-tx degradation) — wallet resolution included, so it
      // sits inside the try.
      try {
        const sender = (await args.deps.resolveWalletAddress(build.user_id)) as `0x${string}`
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
        // (~$0.01 on BASE). Release the reserved slot so it isn't burned for
        // a sponsorship the user never received, then fall through to the
        // plain tx. Best-effort: a release hiccup must NOT turn the
        // degradation into a hard failure — residual drift is swept by the
        // Stage-3 sponsored-tx reconcile (#45, open_issues X3).
        try {
          await args.deps.releaseSponsorship?.(build.user_id)
        } catch {
          // swallow — never block the build on a refund failure
        }
      }
    }

    return {
      kind: 'evm-tx',
      to: args.escrow_contract,
      data: call.data,
      value: call.value_raw,
      ...(args.fee_currency !== undefined ? { fee_currency: args.fee_currency } : {}),
      ...approvalHint(build, ctx.asset_address),
    }
  }

  /**
   * ERC-20 prerequisite the wallet must satisfy before broadcasting a PLAIN
   * call: allowance(owner → escrow) ≥ the pull amount. Permit-built calls
   * carry their own allowance; native assets fund via msg.value.
   */
  function approvalHint(
    build: BuildTxArgs,
    asset_address: string | null,
  ): { approval?: { token: string; spender: string; amount_raw: AmountRaw } } {
    if (asset_address === null) return {}
    if (build.action === 'createEscrow' && build.payload.permit === undefined) {
      return {
        approval: {
          token: asset_address,
          spender: args.escrow_contract,
          amount_raw: build.payload.amount_raw,
        },
      }
    }
    if (
      build.action === 'disputeEscrow' &&
      build.payload.permit === undefined &&
      build.payload.bond_raw !== '0'
    ) {
      return {
        approval: {
          token: asset_address,
          spender: args.escrow_contract,
          amount_raw: build.payload.bond_raw,
        },
      }
    }
    return {}
  }

  async function buildPermitPayload(payload_args: {
    user_id: string
    owner: string
    asset: AssetId
    value_raw: AmountRaw
  }): Promise<PermitPayloadResponse> {
    const { user_id, owner, asset, value_raw } = payload_args
    if (!isAddress(owner)) {
      throw new AppError(422, ErrorCode.VALIDATION_ERROR, 'owner must be a 0x-hex EVM address')
    }
    if (!isAmountRaw(value_raw) || value_raw === '0') {
      throw new AppError(
        422,
        ErrorCode.VALIDATION_ERROR,
        'value_raw must be a positive canonical integer string',
      )
    }
    // The permit owner must be an account the caller controls AND will send
    // from — client-supplied, server-verified against verified linked wallets.
    const owned = (await args.deps.verifyWalletOwnership?.(user_id, owner)) ?? false
    if (!owned) {
      throw new AppError(
        422,
        ErrorCode.VALIDATION_ERROR,
        'owner is not one of your verified linked wallets on this chain',
      )
    }
    // Capability is config: no manifest permit entry → approve flow.
    const permit_config = chainById(args.chain_id).assets.find((a) => a.id === asset)?.permit
    if (permit_config === undefined) {
      throw new AppError(
        422,
        ErrorCode.PERMIT_UNAVAILABLE,
        `asset '${asset}' has no EIP-2612 permit support on ${args.chain_id} — use the approve flow`,
      )
    }
    const { token_address } = await args.deps.resolveAsset(asset)
    if (token_address === null) {
      throw new AppError(
        422,
        ErrorCode.PERMIT_UNAVAILABLE,
        `asset '${asset}' is native on ${args.chain_id} — no allowance needed`,
      )
    }

    const facts = await rpc.readPermitFacts(token_address as `0x${string}`, owner)
    const deadline_unix = Math.floor(Date.now() / 1000) + PERMIT_DEADLINE_SECONDS
    const typed_data = buildPermitTypedData({
      token_name: facts.name,
      permit_version: permit_config.version,
      chain_numeric_id: evmNumericChainId(args.chain_id),
      token: token_address,
      owner,
      spender: args.escrow_contract,
      value_raw,
      nonce: facts.nonce,
      deadline_unix,
    })
    // Runtime guard: the reconstructed domain must hash to the token's LIVE
    // DOMAIN_SEPARATOR — a token rename/upgrade degrades to the approve flow
    // instead of producing signatures the token would reject.
    if (!permitDomainMatches(typed_data, facts.domain_separator)) {
      throw new AppError(
        422,
        ErrorCode.PERMIT_UNAVAILABLE,
        `token domain mismatch for '${asset}' on ${args.chain_id} — use the approve flow`,
      )
    }
    return { typed_data, value_raw, deadline_unix }
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
    if (verify.escrow_id !== undefined && match.fields.escrow_id !== verify.escrow_id) {
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

  return {
    namespace: 'eip155',
    chain_id: args.chain_id,
    buildTx,
    buildPermitPayload,
    verifyTx,
    // Namespace-level crypto (EIP-191 ecrecover) — single source in
    // lib/wallet-signature; the registry's verifyAuthSig delegates to the same.
    verifyAuthSig: (a: VerifyAuthSigArgs) => verifyWalletSignature('eip155', a),
    fetchEscrowState,
    computeFee: (fee_args) => computePlatformFee(fee_args),
  }
}
