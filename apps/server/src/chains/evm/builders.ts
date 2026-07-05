/**
 * EVM call-data builders (stage-3-base.md § EVM adapter). Each escrow
 * action ABI-encodes against the TendaEscrow contract; the BuildTxArgs
 * action names match the Solidity function names 1:1, so the builder is a
 * thin payload→args mapping plus the native-value rule:
 *
 *   - createEscrow with native asset → value = amount
 *   - disputeEscrow with native asset → value = bond
 *   - everything else → value = 0
 *
 * ERC-20 escrows need their allowance satisfied before the call lands:
 * either the client approves first (the adapter emits an `approval` hint on
 * the UnsignedTx), or the payload carries an EIP-2612 `permit` and this
 * builder encodes the *WithPermit entry point so the allowance rides the
 * same transaction.
 */

import { encodeFunctionData, toHex } from 'viem'
import { DISPUTE_WINNER_CODE, ESCROW_KIND_CODE, type PermitSignatureBody } from '@tenda/shared'
import { ErrorCode } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { uuidToBytes } from '@server/chains/ids'
import { ESCROW_EVM_ABI, ZERO_ADDRESS } from './rpc'
import { parsePermitSignature } from './permit'
import type { BuildTxArgs } from '@server/chains/types'

export interface BuiltCall {
  data: `0x${string}`
  /** Native value the tx must carry (stringified wei). */
  value_raw: string
}

export interface BuildContext {
  /** AssetId → ERC-20 address (`null` = native). */
  asset_address: string | null
  /** Resolved wallet of assigned_counterparty_user_id, when present. */
  assigned_counterparty_address: string | null
}


function escrowIdHex(escrow_id: string): `0x${string}` {
  return toHex(uuidToBytes(escrow_id))
}

function asAddress(v: string | null): `0x${string}` {
  return (v ?? ZERO_ADDRESS) as `0x${string}`
}

/** Wire permit → the contract's `Permit` calldata tuple. ERC-20 only. */
function permitTuple(permit: PermitSignatureBody, asset_address: string | null) {
  if (asset_address === null) {
    // Routes validate this too, the builder is the last line of defense
    // (mirrors the contract's own NativeAssetPermit revert).
    throw new AppError(422, ErrorCode.VALIDATION_ERROR, 'permit is not applicable to a native asset')
  }
  const sig = parsePermitSignature(permit.signature)
  return {
    value: BigInt(permit.value_raw),
    deadline: BigInt(permit.deadline_unix),
    v: sig.v,
    r: sig.r,
    s: sig.s,
  }
}

export function buildEvmCall(args: BuildTxArgs, ctx: BuildContext): BuiltCall {
  switch (args.action) {
    case 'createEscrow': {
      const p = args.payload
      const native = ctx.asset_address === null
      const createArgs = [
        escrowIdHex(p.escrow_id),
        ESCROW_KIND_CODE[p.kind],
        asAddress(ctx.asset_address),
        BigInt(p.amount_raw),
        asAddress(ctx.assigned_counterparty_address),
        BigInt(p.accept_deadline_unix),
        BigInt(p.completion_duration_seconds),
        BigInt(p.dispute_bond_raw),
        p.is_seeker,
      ] as const
      if (p.permit !== undefined) {
        return {
          data: encodeFunctionData({
            abi: ESCROW_EVM_ABI,
            functionName: 'createEscrowWithPermit',
            args: [...createArgs, permitTuple(p.permit, ctx.asset_address)],
          }),
          value_raw: '0', // non-payable: the permit path is ERC-20 only
        }
      }
      return {
        data: encodeFunctionData({
          abi: ESCROW_EVM_ABI,
          functionName: 'createEscrow',
          args: createArgs,
        }),
        value_raw: native ? p.amount_raw : '0',
      }
    }
    case 'submitProof': {
      const p = args.payload
      return {
        data: encodeFunctionData({
          abi: ESCROW_EVM_ABI,
          functionName: 'submitProof',
          args: [escrowIdHex(p.escrow_id), p.proof_hash as `0x${string}`],
        }),
        value_raw: '0',
      }
    }
    case 'disputeEscrow': {
      const p = args.payload
      const native = ctx.asset_address === null
      if (p.permit !== undefined) {
        return {
          data: encodeFunctionData({
            abi: ESCROW_EVM_ABI,
            functionName: 'disputeEscrowWithPermit',
            args: [escrowIdHex(p.escrow_id), permitTuple(p.permit, ctx.asset_address)],
          }),
          value_raw: '0',
        }
      }
      return {
        data: encodeFunctionData({
          abi: ESCROW_EVM_ABI,
          functionName: 'disputeEscrow',
          args: [escrowIdHex(p.escrow_id)],
        }),
        value_raw: native ? p.bond_raw : '0',
      }
    }
    case 'resolveDispute': {
      const p = args.payload
      return {
        data: encodeFunctionData({
          abi: ESCROW_EVM_ABI,
          functionName: 'resolveDispute',
          // raiser_user_id intentionally unused: the EVM contract records
          // raisedBy at disputeEscrow time (chains/types.ts documents this).
          args: [escrowIdHex(p.escrow_id), DISPUTE_WINNER_CODE[p.winner]],
        }),
        value_raw: '0',
      }
    }
    // Single-arg escrow-id actions share one encoding shape.
    case 'acceptEscrow':
    case 'declineAssignedEscrow':
    case 'approveCompletion':
    case 'claimStalledPayment':
    case 'cancelEscrow':
    case 'refundExpired':
    case 'reclaimAbandoned':
      return {
        data: encodeFunctionData({
          abi: ESCROW_EVM_ABI,
          functionName: args.action,
          args: [escrowIdHex(args.payload.escrow_id)],
        }),
        value_raw: '0',
      }
  }
}
