/**
 * EVM receipt → DecodedEvent (stage-3-base.md § EVM adapter). The contract
 * event names ARE the wire event vocabulary (chains/types.ts
 * ESCROW_EVENTS), so decoding is decodeEventLog + a defensive narrow, no
 * rename table like the Solana coder path needs.
 */

import { decodeEventLog } from 'viem'
import { DISPUTE_WINNER_CODE } from '@tenda/shared'
import { bytesToUuid } from '@server/chains/ids'
import { ESCROW_EVENTS, type DecodedEvent, type EscrowEvent } from '@server/chains/types'
import { ESCROW_EVM_ABI } from './rpc'
import type { EvmReceiptLog } from './rpc'

/**
 * uint8 winner code → cross-chain winner name ('creator'|'counterparty'|
 * 'split'). The Anchor coder renders the enum VARIANT so Solana fields carry
 * the name; the Solidity event can only carry the code — translate here so
 * applyEscrowEvent's narrowWinner sees one vocabulary.
 */
const WINNER_NAME_BY_CODE = new Map(
  Object.entries(DISPUTE_WINNER_CODE).map(([name, code]) => [String(code), name]),
)

function isEscrowEvent(name: string): name is EscrowEvent {
  return (ESCROW_EVENTS as readonly string[]).includes(name)
}

/** bytes16 hex (0x + 32 chars) → canonical UUID string. */
export function escrowIdHexToUuid(hex: string): string {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  return bytesToUuid(Buffer.from(clean, 'hex'))
}

/**
 * Decode every escrow-contract log in a receipt into wire events. Logs
 * from other contracts (ERC-20 Transfer etc.) and unknown topics are
 * skipped silently, a receipt is allowed to contain foreign noise.
 */
export function decodeEscrowLogs(
  logs: EvmReceiptLog[],
  escrow_contract: string,
  chain_id: string,
): DecodedEvent[] {
  const out: DecodedEvent[] = []
  const target = escrow_contract.toLowerCase()

  for (const log of logs) {
    if (log.address.toLowerCase() !== target) continue
    let decoded: { eventName: string; args: unknown }
    try {
      decoded = decodeEventLog({
        abi: ESCROW_EVM_ABI,
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      })
    } catch {
      continue // topic not in our ABI, foreign/unknown log
    }
    if (!isEscrowEvent(decoded.eventName)) continue

    const args = (decoded.args ?? {}) as Record<string, unknown>
    const escrowIdRaw = args.escrowId
    if (typeof escrowIdRaw !== 'string') continue

    // Stringify every arg so uint256 amounts survive (mirrors the Solana
    // decoder's contract: DecodedEvent.fields are strings). `escrowId` is
    // rendered canonically as `escrow_id` (the UUID), the key applyEscrowEvent
    // and the Solana decoder both use, so the raw bytes16 form is dropped.
    const fields: Record<string, string> = { escrow_id: escrowIdHexToUuid(escrowIdRaw) }
    for (const [k, v] of Object.entries(args)) {
      if (k === 'escrowId') continue
      fields[k] = typeof v === 'bigint' ? v.toString() : String(v)
    }
    if (decoded.eventName === 'DisputeResolved' && fields.winner !== undefined) {
      fields.winner = WINNER_NAME_BY_CODE.get(fields.winner) ?? fields.winner
    }

    const actorRaw = actorOf(decoded.eventName, args)
    out.push({
      name: decoded.eventName,
      escrow_ref: escrowIdRaw,
      ...(actorRaw !== null ? { actor: `${chain_id}:${actorRaw}` as DecodedEvent['actor'] } : {}),
      fields,
    })
  }
  return out
}

/** The event arg that identifies the acting wallet, when one exists. */
function actorOf(name: EscrowEvent, args: Record<string, unknown>): string | null {
  const key =
    name === 'EscrowCreated' || name === 'EscrowApproved'
      ? 'creator'
      : name === 'EscrowAccepted' || name === 'PaymentClaimed'
        ? 'counterparty'
        : name === 'EscrowCancelled' || name === 'EscrowExpired' || name === 'EscrowAbandoned'
          ? 'creator'
          : name === 'EscrowDeclined'
            ? 'declined_by'
            : name === 'DisputeRaised'
              ? 'raised_by'
              : null
  if (key === null) return null
  const v = args[key]
  return typeof v === 'string' ? v : null
}
