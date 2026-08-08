/**
 * On-chain reads the adapter needs BEFORE it can build a transaction: the
 * escrow tuple decode, and the per-action address/asset resolution built on it.
 *
 * Lifted out of the `evmAdapter` closure so the two are reachable and readable
 * on their own — they were the only parts of a 410-line factory that did no
 * building at all. The closure over `args`/`rpc` becomes an explicit
 * `EvmAdapterContext` parameter, which is the whole behavioural difference:
 * same code, dependencies now stated rather than captured.
 *
 * `EvmAdapterArgs` below is an `import type` from ./index, which ./index also
 * imports from — a cycle on paper that TypeScript erases, so nothing circular
 * reaches the runtime. Keep it type-only: turning it into a value import would
 * make it real. `EvmAdapterArgs` stays declared in ./index because that is the
 * adapter's public surface (`@server/chains/evm`).
 */

import { AppError } from '@server/lib/errors'
import { ErrorCode, ESCROW_STATUS_ORDER } from '@tenda/shared'
import { bytesToUuid } from '@server/chains/ids'
import type { BuildTxArgs, EscrowState } from '@server/chains/types'
import { escrowIdHex } from './builders'
import { ZERO_ADDRESS, type EvmRpc } from './rpc'
import type { EvmAdapterArgs } from './index'

/** What the extracted reads need from the adapter that owns them. */
export interface EvmAdapterContext {
  args: EvmAdapterArgs
  rpc: EvmRpc
}

// On-chain status enum → wire status, indexed by the contract's uint8. Sourced
// from the single shared order (guarded against both contracts by
// check-contract-parity) so a contract enum reorder can't silently mis-decode.
const EVM_STATUS: ReadonlyArray<EscrowState['status']> = ESCROW_STATUS_ORDER

export async function fetchEscrowState(
  ctx: EvmAdapterContext,
  escrow_ref: string,
): Promise<EscrowState | null> {
  const tuple = await ctx.rpc.readEscrow(ctx.args.escrow_contract, escrow_ref as `0x${string}`)
  if (tuple === null) return null
  const status = EVM_STATUS[tuple.status]
  if (status === undefined) return null // unknown enum value, treat as absent
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
    requires_approval: tuple.requires_approval,
    unassign_window_seconds: Number(tuple.unassign_window_seconds),
    // The contract doesn't store creation time; reconciliation uses the
    // EscrowCreated event's block timestamp via the DB row instead.
    created_at_unix: 0,
  }
}

export async function buildContext(ctx: EvmAdapterContext, build: BuildTxArgs) {
  if (build.action === 'createEscrow') {
    const { token_address } = await ctx.args.deps.resolveAsset(build.payload.asset)
    const assigned =
      build.payload.assigned_counterparty_user_id !== undefined
        ? await ctx.args.deps.resolveWalletAddress(build.payload.assigned_counterparty_user_id)
        : null
    return {
      asset_address: token_address,
      assigned_counterparty_address: assigned,
      worker_address: null,
    }
  }
  if (build.action === 'disputeEscrow') {
    // Bond denomination follows the escrow's asset, read it on-chain so
    // the value rule can't drift from contract state.
    const state = await fetchEscrowState(ctx, escrowIdHex(build.payload.escrow_id))
    // A null read means THIS contract has no such escrow. Absence must not
    // fall through to `asset_address: null`, which means NATIVE — that would
    // quietly denominate the bond in the gas token instead of the escrow's
    // ERC-20. The realistic cause is an escrow held by a superseded contract
    // (the adapter resolves the contract per chain, not per escrow — see
    // open_issues #89), and the honest answer there is to refuse.
    if (state === null) {
      throw new AppError(
        422,
        ErrorCode.ESCROW_NOT_FUNDED,
        `escrow ${build.payload.escrow_id} does not exist in the escrow contract ` +
          `configured for ${ctx.args.chain_id} (${ctx.args.escrow_contract})`,
      )
    }
    return {
      asset_address: state.asset_address,
      assigned_counterparty_address: null,
      worker_address: null,
    }
  }
  if (build.action === 'assignAccept') {
    return {
      asset_address: null,
      assigned_counterparty_address: null,
      worker_address: await ctx.args.deps.resolveWalletAddress(build.payload.worker_user_id),
    }
  }
  return { asset_address: null, assigned_counterparty_address: null, worker_address: null }
}
