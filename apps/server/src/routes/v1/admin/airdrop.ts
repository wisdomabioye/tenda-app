import { FastifyPluginAsync } from 'fastify'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { airdrop_campaigns, airdrop_recipients, users } from '@tenda/shared/db/schema'
import { ErrorCode, MAX_PAGINATION_LIMIT } from '@tenda/shared'
import { requireRole } from '@server/lib/guards'
import { AppError } from '@server/lib/errors'
import { appEvents } from '@server/lib/events'
import { buildBatchAirdropTransaction, ensureSignatureVerified } from '@server/lib/solana'
import type { ApiError } from '@tenda/shared'

const AIRDROP_ROLES  = ['airdrop', 'super_admin'] as const
const APPROVE_ROLES  = ['super_admin'] as const

// Maximum recipients that can be bulk-added in one request
const MAX_BULK_RECIPIENTS = 1000

const adminAirdrop: FastifyPluginAsync = async (fastify) => {
  // ── GET /v1/admin/airdrop — list campaigns ─────────────────────────────────
  fastify.get<{
    Querystring: { status?: string; limit?: number; offset?: number }
    Reply: { data: unknown[]; total: number; limit: number; offset: number } | ApiError
  }>('/', {
    preHandler: [requireRole(...AIRDROP_ROLES)],
  }, async (request) => {
    const { status, limit = 20, offset = 0 } = request.query
    const safeLimit  = Math.min(Number(limit), MAX_PAGINATION_LIMIT)
    const safeOffset = Number(offset)

    const VALID_STATUSES = ['draft', 'approved', 'in_progress', 'completed', 'cancelled']
    const where = status && VALID_STATUSES.includes(status)
      ? eq(airdrop_campaigns.status, status as typeof airdrop_campaigns.status._.data)
      : undefined

    const [data, countResult] = await Promise.all([
      fastify.db
        .select()
        .from(airdrop_campaigns)
        .where(where)
        .orderBy(sql`created_at desc`)
        .limit(safeLimit)
        .offset(safeOffset),
      fastify.db
        .select({ count: sql<number>`count(*)::int` })
        .from(airdrop_campaigns)
        .where(where),
    ])

    return { data, total: countResult[0].count, limit: safeLimit, offset: safeOffset }
  })

  // ── GET /v1/admin/airdrop/:id — campaign detail with batch summary ─────────
  fastify.get<{
    Params: { id: string }
    Reply: unknown | ApiError
  }>('/:id', {
    preHandler: [requireRole(...AIRDROP_ROLES)],
  }, async (request) => {
    const [campaign] = await fastify.db
      .select()
      .from(airdrop_campaigns)
      .where(eq(airdrop_campaigns.id, request.params.id))
      .limit(1)

    if (!campaign) throw new AppError(404, ErrorCode.NOT_FOUND, 'Campaign not found')

    // Per-batch status summary
    const batchSummary = await fastify.db
      .select({
        batch_index:   airdrop_recipients.batch_index,
        total:         sql<number>`count(*)::int`,
        pending:       sql<number>`count(*) filter (where status = 'pending')::int`,
        distributed:   sql<number>`count(*) filter (where status = 'distributed')::int`,
        failed:        sql<number>`count(*) filter (where status = 'failed')::int`,
        skipped:       sql<number>`count(*) filter (where status = 'skipped')::int`,
      })
      .from(airdrop_recipients)
      .where(eq(airdrop_recipients.campaign_id, request.params.id))
      .groupBy(airdrop_recipients.batch_index)
      .orderBy(airdrop_recipients.batch_index)

    return { ...campaign, batches: batchSummary }
  })

  // ── POST /v1/admin/airdrop — create campaign ───────────────────────────────
  fastify.post<{
    Body:  { name: string; lamports_per_recipient: number; description?: string; batch_size?: number }
    Reply: unknown | ApiError
  }>('/', {
    preHandler: [requireRole(...AIRDROP_ROLES)],
  }, async (request) => {
    const { name, lamports_per_recipient, description, batch_size = 30 } = request.body

    if (!name || name.trim().length === 0) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'name is required')
    }
    if (!Number.isInteger(lamports_per_recipient) || lamports_per_recipient <= 0) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'lamports_per_recipient must be a positive integer')
    }
    if (!Number.isInteger(batch_size) || batch_size < 1 || batch_size > 100) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'batch_size must be an integer between 1 and 100')
    }

    const [campaign] = await fastify.db
      .insert(airdrop_campaigns)
      .values({
        name: name.trim(),
        description: description?.trim() ?? null,
        lamports_per_recipient,
        batch_size,
        created_by: request.user.id,
      })
      .returning()

    return campaign
  })

  // ── POST /v1/admin/airdrop/:id/recipients — bulk-add recipients ────────────
  // Only allowed while campaign is in 'draft' status.
  // wallets: flat array of Solana wallet addresses — amount comes from campaign.lamports_per_recipient.
  // Duplicates within the same campaign are silently ignored (idempotent).
  fastify.post<{
    Params: { id: string }
    Body:   { wallets: string[] }
    Reply:  { added: number; skipped_duplicates: number } | ApiError
  }>('/:id/recipients', {
    preHandler: [requireRole(...AIRDROP_ROLES)],
  }, async (request) => {
    const { wallets } = request.body

    if (!Array.isArray(wallets) || wallets.length === 0) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'wallets array is required and must be non-empty')
    }
    if (wallets.length > MAX_BULK_RECIPIENTS) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, `Maximum ${MAX_BULK_RECIPIENTS} wallets per request`)
    }
    if (wallets.some((w) => typeof w !== 'string' || w.trim().length === 0)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Each wallet must be a non-empty string')
    }

    const [campaign] = await fastify.db
      .select({
        id:              airdrop_campaigns.id,
        status:          airdrop_campaigns.status,
        batch_size:      airdrop_campaigns.batch_size,
        recipient_count: airdrop_campaigns.recipient_count,
        lamports_per_recipient: airdrop_campaigns.lamports_per_recipient,
      })
      .from(airdrop_campaigns)
      .where(eq(airdrop_campaigns.id, request.params.id))
      .limit(1)

    if (!campaign) throw new AppError(404, ErrorCode.NOT_FOUND, 'Campaign not found')
    if (campaign.status !== 'draft') {
      throw new AppError(409, ErrorCode.VALIDATION_ERROR, 'Recipients can only be added to draft campaigns')
    }

    // Resolve known user_ids by wallet address (best-effort — null is fine)
    const userRows = await fastify.db
      .select({ id: users.id, wallet_address: users.wallet_address })
      .from(users)
      .where(inArray(users.wallet_address, wallets))
    const walletToUserId = new Map(userRows.map((u) => [u.wallet_address, u.id]))

    // Assign batch indexes based on current recipient_count
    let nextPosition = campaign.recipient_count
    const rows = wallets.map((wallet) => ({
      campaign_id:    campaign.id,
      user_id:        walletToUserId.get(wallet) ?? null,
      wallet_address: wallet.trim(),
      batch_index:    Math.floor(nextPosition++ / campaign.batch_size),
    }))

    // Batch insert with ON CONFLICT DO NOTHING for idempotency.
    // .returning() only returns the rows actually inserted (skipped rows are absent).
    const inserted = await fastify.db
      .insert(airdrop_recipients)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: airdrop_recipients.id })

    const added             = inserted.length
    const skipped_duplicates = rows.length - added

    if (added > 0) {
      // Use atomic SQL increment to avoid a race condition when concurrent
      // requests add recipients to the same campaign simultaneously.
      await fastify.db
        .update(airdrop_campaigns)
        .set({
          recipient_count: sql`recipient_count + ${added}`,
          total_lamports:  sql`total_lamports  + ${added * campaign.lamports_per_recipient}`,
          updated_at: new Date(),
        })
        .where(eq(airdrop_campaigns.id, campaign.id))
    }

    return { added, skipped_duplicates }
  })

  // ── POST /v1/admin/airdrop/:id/approve — approve for distribution ──────────
  fastify.post<{
    Params: { id: string }
    Reply:  unknown | ApiError
  }>('/:id/approve', {
    preHandler: [requireRole(...APPROVE_ROLES)],
  }, async (request) => {
    const [campaign] = await fastify.db
      .select()
      .from(airdrop_campaigns)
      .where(eq(airdrop_campaigns.id, request.params.id))
      .limit(1)

    if (!campaign) throw new AppError(404, ErrorCode.NOT_FOUND, 'Campaign not found')
    if (campaign.status !== 'draft') {
      throw new AppError(409, ErrorCode.VALIDATION_ERROR, `Campaign is already ${campaign.status}`)
    }
    if (campaign.recipient_count === 0) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Cannot approve a campaign with no recipients')
    }

    const now = new Date()
    const [updated] = await fastify.db
      .update(airdrop_campaigns)
      .set({ status: 'approved', approved_by: request.user.id, approved_at: now, updated_at: now })
      .where(and(eq(airdrop_campaigns.id, request.params.id), eq(airdrop_campaigns.status, 'draft')))
      .returning()

    if (!updated) throw new AppError(409, ErrorCode.VALIDATION_ERROR, 'Campaign status changed — try again')

    appEvents.emit('admin.approve_airdrop', {
      adminId:      request.user.id,
      adminWallet:  request.user.wallet_address,
      adminRole:    request.user.role,
      campaignId:   updated.id,
      campaignName: updated.name,
    })

    return updated
  })

  // ── GET /v1/admin/airdrop/:id/batches/:batchIndex/build ───────────────────
  // Builds an unsigned versioned transaction for the treasury wallet to sign.
  // Requires batch_airdrop_gas_subsidy instruction (returns 501 until deployed).
  fastify.get<{
    Params: { id: string; batchIndex: string }
    Querystring: { treasury: string }
    Reply: { transaction: string; recipient_count: number } | ApiError
  }>('/:id/batches/:batchIndex/build', {
    preHandler: [requireRole(...AIRDROP_ROLES)],
  }, async (request) => {
    const { id } = request.params
    const batchIndex = Number(request.params.batchIndex)
    const { treasury } = request.query

    if (!Number.isInteger(batchIndex) || batchIndex < 0) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'batchIndex must be a non-negative integer')
    }
    if (!treasury) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'treasury query param is required (the signing wallet address)')
    }

    const [campaign] = await fastify.db
      .select({ status: airdrop_campaigns.status, lamports_per_recipient: airdrop_campaigns.lamports_per_recipient })
      .from(airdrop_campaigns)
      .where(eq(airdrop_campaigns.id, id))
      .limit(1)

    if (!campaign) throw new AppError(404, ErrorCode.NOT_FOUND, 'Campaign not found')
    if (campaign.status !== 'approved' && campaign.status !== 'in_progress') {
      throw new AppError(409, ErrorCode.VALIDATION_ERROR, 'Campaign must be approved before building transactions')
    }

    const batch = await fastify.db
      .select({ wallet_address: airdrop_recipients.wallet_address })
      .from(airdrop_recipients)
      .where(and(
        eq(airdrop_recipients.campaign_id, id),
        eq(airdrop_recipients.batch_index, batchIndex),
        eq(airdrop_recipients.status, 'pending'),
      ))

    if (batch.length === 0) {
      throw new AppError(404, ErrorCode.NOT_FOUND, 'No pending recipients in this batch')
    }

    // Throws 501 until batch_airdrop_gas_subsidy is deployed
    const { transaction } = await buildBatchAirdropTransaction(
      treasury,
      batch.map((r) => ({ walletAddress: r.wallet_address, lamports: campaign.lamports_per_recipient })),
    )

    return { transaction, recipient_count: batch.length }
  })

  // ── POST /v1/admin/airdrop/:id/batches/:batchIndex/confirm ────────────────
  // Records an on-chain confirmation for a completed batch.
  // Verifies the signature on-chain then marks all pending recipients as distributed.
  fastify.post<{
    Params: { id: string; batchIndex: string }
    Body:   { signature: string }
    Reply:  { distributed: number } | ApiError
  }>('/:id/batches/:batchIndex/confirm', {
    preHandler: [requireRole(...AIRDROP_ROLES)],
  }, async (request) => {
    const { id } = request.params
    const batchIndex = Number(request.params.batchIndex)
    const { signature } = request.body

    if (!Number.isInteger(batchIndex) || batchIndex < 0) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'batchIndex must be a non-negative integer')
    }
    if (!signature) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'signature is required')
    }

    const [campaign] = await fastify.db
      .select({ id: airdrop_campaigns.id, status: airdrop_campaigns.status, name: airdrop_campaigns.name })
      .from(airdrop_campaigns)
      .where(eq(airdrop_campaigns.id, id))
      .limit(1)

    if (!campaign) throw new AppError(404, ErrorCode.NOT_FOUND, 'Campaign not found')
    if (campaign.status !== 'approved' && campaign.status !== 'in_progress') {
      throw new AppError(409, ErrorCode.VALIDATION_ERROR, 'Campaign must be approved to confirm batches')
    }

    // Verify the signature is confirmed on-chain
    // Note: we don't check the instruction name here since batch_airdrop_gas_subsidy
    // isn't in the current IDL — verify confirmation only until new IDL is deployed.
    await ensureSignatureVerified(signature)

    const now = new Date()

    // Mark all pending recipients in this batch as distributed
    const updated = await fastify.db
      .update(airdrop_recipients)
      .set({ status: 'distributed', signature, distributed_at: now })
      .where(and(
        eq(airdrop_recipients.campaign_id, id),
        eq(airdrop_recipients.batch_index, batchIndex),
        eq(airdrop_recipients.status, 'pending'),
      ))
      .returning({ id: airdrop_recipients.id })

    const distributed = updated.length

    // Check if all recipients are now done — if so, mark campaign completed
    const [remaining] = await fastify.db
      .select({ count: sql<number>`count(*)::int` })
      .from(airdrop_recipients)
      .where(and(
        eq(airdrop_recipients.campaign_id, id),
        eq(airdrop_recipients.status, 'pending'),
      ))

    const newStatus = remaining.count === 0 ? 'completed' : 'in_progress'
    await fastify.db
      .update(airdrop_campaigns)
      .set({
        status:       newStatus,
        completed_at: newStatus === 'completed' ? now : null,
        updated_at:   now,
      })
      .where(eq(airdrop_campaigns.id, id))

    appEvents.emit('admin.confirm_airdrop_batch', {
      adminId:        request.user.id,
      adminWallet:    request.user.wallet_address,
      adminRole:      request.user.role,
      campaignId:     id,
      batchIndex,
      signature,
      recipientCount: distributed,
    })

    return { distributed }
  })
}

export default adminAirdrop
