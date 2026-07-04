/**
 * Validation + normalization for POST /v1/escrows (the create entry).
 *
 * Pure module — no DB, no chain I/O — so every rule is unit-testable. The
 * route supplies caller identity and persistence; the on-chain program
 * re-validates everything that matters financially (this layer exists to
 * fail fast with typed errors, not to be the security boundary).
 */

import { ErrorCode, AMOUNT_RAW_PRECISION, type PermitSignatureBody } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { assertGigAsset } from '@server/lib/escrow'
import { validateWirePermit } from '@server/chains/evm/permit'
import { isAmountRaw, type AmountRaw, type AssetId, type ChainId } from '@server/chains/types'

export interface CreateEscrowBody {
  kind?: unknown
  chain_id?: unknown
  asset?: unknown
  amount_raw?: unknown
  accept_deadline_unix?: unknown
  completion_duration_seconds?: unknown
  dispute_bond_raw?: unknown
  assigned_counterparty_id?: unknown
  /** EIP-2612 signature riding the create (EVM ERC-20 assets only). */
  permit?: unknown
  /** Forbidden — server generates ids (stage-0 exit criterion). */
  id?: unknown
}

export interface ValidatedCreateEscrow {
  kind: 'gig' | 'exchange'
  chain_id: ChainId
  asset: AssetId
  amount_raw: AmountRaw
  accept_deadline_unix: number
  completion_duration_seconds: number
  dispute_bond_raw: AmountRaw
  assigned_counterparty_id: string | null
  permit: PermitSignatureBody | null
}

export interface ValidateCreateDeps {
  /** Registry membership check — unknown chains fail fast. */
  hasChain(chain_id: ChainId): boolean
  /** Injected clock for deterministic deadline tests. */
  now(): Date
  /** Caller identity — assigned counterparty must differ. */
  caller_user_id: string
}

function fail(message: string): never {
  throw new AppError(422, ErrorCode.VALIDATION_ERROR, message)
}

export function validateCreateEscrow(
  deps: ValidateCreateDeps,
  body: CreateEscrowBody,
): ValidatedCreateEscrow {
  if (body.id !== undefined) {
    // Server-generated ids only — a client-supplied id could front-run the
    // PDA derivation of someone else's draft.
    throw new AppError(
      400,
      ErrorCode.VALIDATION_ERROR,
      'id is server-generated; do not supply one',
    )
  }

  const kind = body.kind
  if (kind !== 'gig' && kind !== 'exchange') fail("kind must be 'gig' or 'exchange'")

  if (typeof body.chain_id !== 'string' || body.chain_id === '') fail('chain_id is required')
  const chain_id = body.chain_id
  if (!deps.hasChain(chain_id)) {
    throw new AppError(422, ErrorCode.VALIDATION_ERROR, `unsupported chain_id '${chain_id}'`)
  }

  if (typeof body.asset !== 'string' || body.asset === '') fail('asset is required')
  const asset = body.asset
  if (kind === 'gig') assertGigAsset(asset, chain_id)

  if (!isAmountRaw(body.amount_raw)) fail('amount_raw must be a canonical integer string')
  const amount_raw = body.amount_raw
  if (amount_raw === '0') fail('amount_raw must be positive')
  if (amount_raw.length > AMOUNT_RAW_PRECISION) {
    fail(`amount_raw exceeds the maximum precision of ${AMOUNT_RAW_PRECISION} digits`)
  }

  const dispute_bond_raw = body.dispute_bond_raw ?? '0'
  if (!isAmountRaw(dispute_bond_raw)) {
    fail('dispute_bond_raw must be a canonical integer string')
  }
  if (dispute_bond_raw.length > AMOUNT_RAW_PRECISION) {
    fail(`dispute_bond_raw exceeds the maximum precision of ${AMOUNT_RAW_PRECISION} digits`)
  }

  if (
    typeof body.accept_deadline_unix !== 'number' ||
    !Number.isInteger(body.accept_deadline_unix)
  ) {
    fail('accept_deadline_unix must be an integer unix timestamp')
  }
  const accept_deadline_unix = body.accept_deadline_unix
  if (accept_deadline_unix <= Math.floor(deps.now().getTime() / 1000)) {
    fail('accept_deadline_unix must be in the future')
  }

  if (
    typeof body.completion_duration_seconds !== 'number' ||
    !Number.isInteger(body.completion_duration_seconds) ||
    body.completion_duration_seconds <= 0
  ) {
    fail('completion_duration_seconds must be a positive integer')
  }
  const completion_duration_seconds = body.completion_duration_seconds

  let assigned_counterparty_id: string | null = null
  if (body.assigned_counterparty_id !== undefined && body.assigned_counterparty_id !== null) {
    if (typeof body.assigned_counterparty_id !== 'string' || body.assigned_counterparty_id === '') {
      fail('assigned_counterparty_id must be a user id')
    }
    if (body.assigned_counterparty_id === deps.caller_user_id) {
      fail('assigned_counterparty_id cannot be the creator')
    }
    assigned_counterparty_id = body.assigned_counterparty_id
  }

  // Field-level permit checks are pure and live here; the route enforces
  // the namespace (eip155 only) and the builder rejects native assets.
  const permit =
    body.permit !== undefined && body.permit !== null
      ? validateWirePermit({ raw: body.permit, transfer_amount_raw: amount_raw, now: deps.now() })
      : null

  return {
    kind,
    chain_id,
    asset,
    amount_raw,
    accept_deadline_unix,
    completion_duration_seconds,
    dispute_bond_raw,
    assigned_counterparty_id,
    permit,
  }
}
