// Fastify plugin that centralises all admin audit-log writes.
// Route handlers emit typed 'admin.*' events — this plugin is the single place
// that translates them into admin_audit_log rows. Follows the same pattern as
// plugins/notifications.ts (event-driven, fire-and-forget per listener).
import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { admin_audit_log } from '@tenda/shared/db/schema'
import { appEvents } from '@server/lib/events'

const auditPlugin: FastifyPluginAsync = async (fastify) => {
  // JSON-serializable value — used only internally for the jsonb metadata column.
  type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue }

  async function write(
    adminId:     string,
    adminWallet: string,
    adminRole:   string,
    action:      string,
    targetType?: string,
    targetId?:   string,
    metadata?:   { [k: string]: JsonValue },
  ): Promise<void> {
    await fastify.db.insert(admin_audit_log).values({
      admin_id:    adminId,
      admin_wallet: adminWallet,
      admin_role:  adminRole,
      action,
      target_type: targetType ?? null,
      target_id:   targetId   ?? null,
      metadata:    metadata   ?? null,
    })
  }

  // ── User management ────────────────────────────────────────────────────────

  appEvents.on('admin.suspend_user', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'suspend_user', 'user', d.userId, { previous_status: d.previousStatus })
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.suspend_user write failed') }
  })

  appEvents.on('admin.reinstate_user', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'reinstate_user', 'user', d.userId)
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.reinstate_user write failed') }
  })

  appEvents.on('admin.change_role', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'change_role', 'user', d.userId, { previous_role: d.previousRole, new_role: d.newRole })
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.change_role write failed') }
  })

  // ── Platform config ────────────────────────────────────────────────────────

  appEvents.on('admin.update_platform_config', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'update_platform_config', 'platform_config', undefined, { changes: d.changes })
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.update_platform_config write failed') }
  })

  // ── Moderation ─────────────────────────────────────────────────────────────

  appEvents.on('admin.add_keyword', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'add_blocked_keyword', 'keyword', undefined, { keyword: d.keyword })
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.add_keyword write failed') }
  })

  appEvents.on('admin.remove_keyword', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'remove_blocked_keyword', 'keyword', d.keywordId, { keyword: d.keyword })
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.remove_keyword write failed') }
  })

  appEvents.on('admin.action_report', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'action_report', 'report', d.reportId, { new_status: d.newStatus, admin_note: d.adminNote ?? null })
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.action_report write failed') }
  })

  // ── Content moderation (Phase 2) ───────────────────────────────────────────

  appEvents.on('admin.hide_gig', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'hide_gig', 'gig', d.gigId, { reason: d.reason ?? null })
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.hide_gig write failed') }
  })

  appEvents.on('admin.unhide_gig', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'unhide_gig', 'gig', d.gigId)
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.unhide_gig write failed') }
  })

  appEvents.on('admin.force_expire_gig', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'force_expire_gig', 'gig', d.gigId)
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.force_expire_gig write failed') }
  })

  appEvents.on('admin.hide_exchange', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'hide_exchange', 'exchange_offer', d.offerId, { reason: d.reason ?? null })
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.hide_exchange write failed') }
  })

  // ── Dispute mediation (Phase 3) ────────────────────────────────────────────

  appEvents.on('admin.open_dispute_thread', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'open_dispute_thread', 'dispute', d.disputeId, { type: d.disputeType })
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.open_dispute_thread write failed') }
  })

  appEvents.on('admin.assign_dispute', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'assign_dispute', 'dispute', d.disputeId, { assigned_to_id: d.assignedToId, assigned_to_wallet: d.assignedToWallet })
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.assign_dispute write failed') }
  })

  appEvents.on('admin.resolve_dispute', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'resolve_dispute', 'dispute', d.disputeId, { winner: d.winner, signature: d.signature, type: d.disputeType })
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.resolve_dispute write failed') }
  })

  // ── Marketing (Phase 4) ────────────────────────────────────────────────────

  appEvents.on('admin.create_announcement', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'create_announcement', 'announcement', d.announcementId, { title: d.title, priority: d.priority })
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.create_announcement write failed') }
  })

  appEvents.on('admin.update_announcement', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'update_announcement', 'announcement', d.announcementId, { title: d.title })
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.update_announcement write failed') }
  })

  appEvents.on('admin.delete_announcement', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'delete_announcement', 'announcement', d.announcementId, { title: d.title })
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.delete_announcement write failed') }
  })

  appEvents.on('admin.broadcast_push', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'broadcast_push', 'push', undefined, { target: d.target, attempted_count: d.attemptedCount })
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.broadcast_push write failed') }
  })

  appEvents.on('admin.feature_gig', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'feature_gig', 'gig', d.gigId)
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.feature_gig write failed') }
  })

  appEvents.on('admin.unfeature_gig', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'unfeature_gig', 'gig', d.gigId)
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.unfeature_gig write failed') }
  })

  // ── Airdrop (Phase 5) ──────────────────────────────────────────────────────

  appEvents.on('admin.approve_airdrop', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'approve_airdrop', 'airdrop_campaign', d.campaignId, { campaign_name: d.campaignName })
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.approve_airdrop write failed') }
  })

  appEvents.on('admin.confirm_airdrop_batch', async (d) => {
    try {
      await write(d.adminId, d.adminWallet, d.adminRole, 'confirm_airdrop_batch', 'airdrop_campaign', d.campaignId, { batch_index: d.batchIndex, signature: d.signature, recipient_count: d.recipientCount })
    } catch (err) { fastify.log.warn({ err }, '[audit] admin.confirm_airdrop_batch write failed') }
  })
}

export default fp(auditPlugin)
