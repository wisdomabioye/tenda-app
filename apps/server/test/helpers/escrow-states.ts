/**
 * Composite DB states + request-body builders shared by the CO2 route-matrix
 * suites (test/integration/escrows-*.test.ts, gigs-listing.test.ts). Keeps
 * each suite reading as "what's being asserted", per the helpers convention.
 */
import type { FastifyInstance } from 'fastify'
import { disputes } from '@tenda/shared/db/schema'
import {
  TEST_CHAIN_ID,
  TEST_ASSET,
  createUser,
  createEscrow,
  attachGigDetails,
  type TestUser,
} from './test-app'
import type { EscrowRow } from './fixtures'

// ---------- request bodies --------------------------------------------------

/** Valid POST /v1/escrows body on the harness chain/asset. */
export function createEscrowBody(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'gig',
    chain_id: TEST_CHAIN_ID,
    asset: TEST_ASSET,
    amount_raw: '1000000',
    accept_deadline_unix: Math.floor(Date.now() / 1000) + 86_400,
    completion_duration_seconds: 3_600,
    ...overrides,
  }
}

/** Valid POST /v1/gigs body (non-remote gigs require country + city). */
export function gigDetailsBody(escrow_id: string, overrides: Record<string, unknown> = {}) {
  return { escrow_id, title: 'Wash my car', category: 'service', country: 'NG', city: 'Lagos', ...overrides }
}

/** Cloudinary URL inside the uploading user's own proofs folder. */
export function proofUrl(userId: string, n: number): string {
  return `https://res.cloudinary.com/test-cloud/image/upload/tenda/proofs/${userId}/p${n}.jpg`
}

// ---------- composite DB states ----------------------------------------------

export interface PartiedEscrow {
  creator: TestUser
  worker: TestUser
  escrow: EscrowRow
}

/** Creator + counterparty on an escrow in the given status. */
export async function partiedEscrow(
  app: FastifyInstance,
  status: 'accepted' | 'submitted' | 'completed',
): Promise<PartiedEscrow> {
  const creator = await createUser(app)
  const worker = await createUser(app)
  const escrow = await createEscrow(app, {
    creator_id: creator.row.id,
    counterparty_id: worker.row.id,
    status,
  })
  return { creator, worker, escrow }
}

export interface DisputedEscrow extends PartiedEscrow {
  dispute_id: string
}

/** Parties + a live dispute row (escrow status 'disputed'). */
export async function disputedEscrow(app: FastifyInstance): Promise<DisputedEscrow> {
  const creator = await createUser(app)
  const worker = await createUser(app)
  const escrow = await createEscrow(app, {
    creator_id: creator.row.id,
    counterparty_id: worker.row.id,
    status: 'disputed',
  })
  const [row] = await app.db
    .insert(disputes)
    .values({ escrow_id: escrow.id, raised_by: creator.row.id, reason: 'Work was never delivered as agreed' })
    .returning({ id: disputes.id })
  return { creator, worker, escrow, dispute_id: row.id }
}

/** A publicly-listed open gig (escrow + details satellite). */
export async function openGig(
  app: FastifyInstance,
  args: {
    title?: string
    category?: string
    country?: string
    amount_raw?: string
    /** Settle on a non-default chain — requires `seedAltChain` (FK). */
    chain_id?: string
    asset?: string
  } = {},
): Promise<{ creator: TestUser; escrow: EscrowRow }> {
  const creator = await createUser(app)
  const escrow = await createEscrow(app, {
    creator_id: creator.row.id,
    status: 'open',
    amount_raw: args.amount_raw ?? '1000000',
    ...(args.chain_id === undefined ? {} : { chain_id: args.chain_id }),
    ...(args.asset === undefined ? {} : { asset: args.asset }),
  })
  await attachGigDetails(app, escrow.id, {
    title: args.title ?? 'Open gig',
    category: args.category ?? 'service',
    country: args.country ?? 'NG',
  })
  return { creator, escrow }
}
