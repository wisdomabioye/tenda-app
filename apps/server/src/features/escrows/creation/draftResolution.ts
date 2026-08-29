/**
 * The DRAFT half of escrow creation, shared by POST /v1/escrows and the
 * agent one-shot (POST /v1/agent/tasks): find the draft a
 * `creation_operation_id` already minted — refusing changed terms and any
 * row that is no longer a replayable draft — or insert a new one, settling
 * the concurrent-identical-request race on the unique operation key.
 *
 * Two entry points rather than one on purpose. POST /v1/escrows builds the
 * unsigned transaction BEFORE it inserts, so a builder failure never strands
 * an orphan draft; the agent route has nothing to build first. Each caller
 * therefore sequences `findReplayedDraft` → (its own work) → `insertDraft`,
 * and the replay rules live here exactly once.
 */
import { and, eq, sql } from 'drizzle-orm'
import { ErrorCode } from '@tenda/shared'
import { escrows } from '@tenda/shared/db/schema'
import { AppError } from '@server/lib/errors'
import { assertNotTakenDown } from '@server/lib/escrow'
import type { EscrowRow } from '@server/lib/escrow-routes'
import type { AppDatabase } from '@server/plugins/db'
import type { ValidatedCreateEscrow } from './validateCreateEscrow'
import { hasPendingEscrowCreateTransaction } from './hasPendingEscrowCreateTransaction'

/** The terms a draft is keyed and compared by — the validator's output, minus the permit. */
export type DraftTerms = Omit<ValidatedCreateEscrow, 'permit'>

export interface DraftIdentity {
  user_id: string
  terms: DraftTerms
  /** The assignee's CURRENT wallet, re-resolved by the caller (null when unassigned). */
  assigned_counterparty_address: string | null
}

export interface DraftInsert extends DraftIdentity {
  escrow_id: string
  is_seeker: boolean
  unassign_window_seconds: number
  /** The chain's current contract, normalised — what the create will target. */
  escrow_contract: string
}

function matchesTerms(row: EscrowRow, terms: DraftTerms): boolean {
  return (
    row.kind === terms.kind &&
    row.chain_id === terms.chain_id &&
    row.asset === terms.asset &&
    row.amount_raw === terms.amount_raw &&
    row.assigned_counterparty_id === terms.assigned_counterparty_id &&
    row.requires_approval === terms.requires_approval &&
    row.completion_duration_seconds === terms.completion_duration_seconds &&
    row.dispute_bond_raw === terms.dispute_bond_raw &&
    row.accept_deadline?.getTime() === terms.accept_deadline_unix * 1000
  )
}

async function assertReplayable(db: AppDatabase, row: EscrowRow): Promise<void> {
  if (row.status !== 'draft') {
    throw new AppError(409, ErrorCode.ESCROW_WRONG_STATUS, 'This creation operation is no longer a draft')
  }
  assertNotTakenDown(row, 'create')
  if (await hasPendingEscrowCreateTransaction(db, row.id)) {
    throw new AppError(
      409,
      ErrorCode.ESCROW_WRONG_STATUS,
      'A create transaction is awaiting confirmation, wait for it to settle',
    )
  }
}

/**
 * A replayed/raced create REBUILDS the tx, and the rebuild bakes the
 * assignee's CURRENT primary — so the row must follow (the same record-=-bake
 * invariant build-create keeps). No-op for unassigned escrows and unchanged
 * wallets; draft-guarded like every draft write.
 */
async function restampAssignee(db: AppDatabase, row: EscrowRow, address: string | null): Promise<EscrowRow> {
  if (address === null || row.assigned_counterparty_address === address) return row
  await db
    .update(escrows)
    .set({ assigned_counterparty_address: address })
    .where(and(eq(escrows.id, row.id), eq(escrows.status, 'draft')))
  return { ...row, assigned_counterparty_address: address }
}

/** The one verified path a found row takes: same terms, still a draft, restamped. */
async function replay(db: AppDatabase, row: EscrowRow, args: DraftIdentity): Promise<EscrowRow> {
  if (!matchesTerms(row, args.terms)) {
    throw new AppError(
      409,
      ErrorCode.VALIDATION_ERROR,
      'creation_operation_id was already used with different escrow terms',
    )
  }
  await assertReplayable(db, row)
  return restampAssignee(db, row, args.assigned_counterparty_address)
}

/**
 * The draft this caller's `creation_operation_id` already minted, verified
 * against the terms sent now, or null when the operation is new (or the
 * caller sent no operation id, which never replays).
 */
export async function findReplayedDraft(db: AppDatabase, args: DraftIdentity): Promise<EscrowRow | null> {
  if (args.terms.creation_operation_id === null) return null
  const row = await db.query.escrows.findFirst({
    where: and(
      eq(escrows.creator_id, args.user_id),
      eq(escrows.creation_operation_id, args.terms.creation_operation_id),
    ),
  })
  return row === undefined ? null : replay(db, row, args)
}

/**
 * The columns a new draft is inserted with — exported so POST /v1/escrows
 * can build the unsigned transaction from EXACTLY these values before the
 * row exists (build-before-insert), rather than from a parallel spelling.
 */
export function draftColumns(args: DraftInsert): typeof escrows.$inferInsert & DraftWindowsPresent & { id: string } {
  const { terms } = args
  return {
    id: args.escrow_id,
    creation_operation_id: terms.creation_operation_id,
    kind: terms.kind,
    chain_id: terms.chain_id,
    asset: terms.asset,
    amount_raw: terms.amount_raw,
    creator_id: args.user_id,
    assigned_counterparty_id: terms.assigned_counterparty_id,
    assigned_counterparty_address: args.assigned_counterparty_address,
    requires_approval: terms.requires_approval,
    unassign_window_seconds: args.unassign_window_seconds,
    status: 'draft',
    // The contract this create targets. A new escrow always joins the
    // CURRENT deployment — but it must be recorded, because by the time a
    // transition is built "current" may mean a different contract and the
    // funds will not have moved with it. Re-attested from the EscrowCreated
    // log when the tx lands (lib/escrow-events).
    escrow_contract: args.escrow_contract,
    accept_deadline: new Date(terms.accept_deadline_unix * 1000),
    completion_duration_seconds: terms.completion_duration_seconds,
    dispute_bond_raw: terms.dispute_bond_raw,
    is_seeker: args.is_seeker,
  }
}

/** The two windows every inserted draft carries — typed present, not `| null`, for the payload mapping. */
interface DraftWindowsPresent {
  accept_deadline: Date
  completion_duration_seconds: number
  unassign_window_seconds: number
  is_seeker: boolean
  requires_approval: boolean
  assigned_counterparty_id: string | null
  dispute_bond_raw: string
}

/**
 * Insert the draft. A concurrent identical request may win the unique
 * operation key between the caller's `findReplayedDraft` and this insert; the
 * loser then follows the verified replay path and returns the winner's row,
 * so both callers hold ONE draft. `created` says which of the two happened.
 */
export async function insertDraft(
  db: AppDatabase,
  args: DraftInsert,
): Promise<{ row: EscrowRow; created: boolean }> {
  const { terms } = args
  const values = draftColumns(args)
  const inserted = terms.creation_operation_id === null
    ? await db.insert(escrows).values(values).returning()
    : await db.insert(escrows).values(values).onConflictDoNothing({
        target: [escrows.creator_id, escrows.creation_operation_id],
        where: sql`${escrows.creation_operation_id} IS NOT NULL`,
      }).returning()
  const row = inserted[0]
  if (row !== undefined) return { row, created: true }
  const winner = await findReplayedDraft(db, args)
  if (winner === null) {
    throw new AppError(409, ErrorCode.INTERNAL_ERROR, 'Could not reconcile escrow creation')
  }
  return { row: winner, created: false }
}
