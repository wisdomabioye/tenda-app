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
 * ERC-20 escrows additionally need a client-side `approve()` before
 * create/dispute — that's the mobile wallet flow's job (#46); the server
 * returns only the escrow call (mirrors how Solana ATAs are the wallet's
 * concern).
 */

import { encodeFunctionData, toHex } from 'viem'
import { uuidToBytes } from '@server/chains/ids'
import { ESCROW_EVM_ABI, ZERO_ADDRESS } from './rpc'
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

const WINNER_CODE = { creator: 0, counterparty: 1, split: 2 } as const

function escrowIdHex(escrow_id: string): `0x${string}` {
  return toHex(uuidToBytes(escrow_id))
}

function asAddress(v: string | null): `0x${string}` {
  return (v ?? ZERO_ADDRESS) as `0x${string}`
}

export function buildEvmCall(args: BuildTxArgs, ctx: BuildContext): BuiltCall {
  switch (args.action) {
    case 'createEscrow': {
      const p = args.payload
      const native = ctx.asset_address === null
      return {
        data: encodeFunctionData({
          abi: ESCROW_EVM_ABI,
          functionName: 'createEscrow',
          args: [
            escrowIdHex(p.escrow_id),
            p.kind === 'gig' ? 0 : 1,
            asAddress(ctx.asset_address),
            BigInt(p.amount_raw),
            asAddress(ctx.assigned_counterparty_address),
            BigInt(p.accept_deadline_unix),
            BigInt(p.completion_duration_seconds),
            BigInt(p.dispute_bond_raw),
            p.is_seeker,
          ],
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
          args: [escrowIdHex(p.escrow_id), WINNER_CODE[p.winner]],
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
