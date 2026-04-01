import { EventEmitter } from 'node:events'

// ── Admin base shape ──────────────────────────────────────────────────────────

interface AdminEventBase {
  adminId:     string
  adminWallet: string
  adminRole:   string
}

// ── Shared base shapes ──────────────────────────────────────────────────────

interface GigEventBase {
  gigId:    string
  posterId: string
  workerId: string
  title:    string
}

interface ExchangeEventBase {
  offerId:    string
  sellerId:   string
  buyerId:    string
  currency:   string
  fiatAmount: number
}

// ── Typed event map ────────────────────────────────────────────────────────

export interface AppEvents {
  'gig.accepted':       GigEventBase
  'gig.submitted':      GigEventBase
  'gig.approved':       GigEventBase
  'gig.disputed':       GigEventBase & { raisedById: string }
  'gig.resolved':       GigEventBase & { winner: string }
  'gig.created':        { gigId: string; posterId: string; city: string | null; category: string; title: string }
  'message.sent':       { conversationId: string; senderId: string; recipientId: string; preview: string }
  'review.submitted':   { gigId: string; reviewerId: string; revieweeId: string; score: number; title: string }
  'proof.added':        GigEventBase
  'exchange.accepted':  ExchangeEventBase
  'exchange.paid':      ExchangeEventBase
  'exchange.confirmed': ExchangeEventBase
  'exchange.disputed':  ExchangeEventBase & { raisedById: string }
  'exchange.resolved':  ExchangeEventBase & { winner: string }
  'exchange.cancelled': Omit<ExchangeEventBase, 'buyerId'> & { buyerId: string | null }

  // ── Admin audit events ────────────────────────────────────────────────────
  // Each event carries AdminEventBase so the audit plugin can write a full log
  // entry without the route knowing anything about the audit table.

  // Phase 1 — role system & existing routes
  'admin.suspend_user':           AdminEventBase & { userId: string; previousStatus: string }
  'admin.reinstate_user':         AdminEventBase & { userId: string }
  'admin.change_role':            AdminEventBase & { userId: string; previousRole: string; newRole: string }
  'admin.update_platform_config': AdminEventBase & { changes: { fee_bps?: number; seeker_fee_bps?: number; grace_period_seconds?: number } }
  'admin.add_keyword':            AdminEventBase & { keyword: string }
  'admin.remove_keyword':         AdminEventBase & { keywordId: string; keyword: string }
  'admin.action_report':          AdminEventBase & { reportId: string; newStatus: string; adminNote?: string }

  // Phase 2 — content moderation
  'admin.hide_gig':               AdminEventBase & { gigId: string; reason?: string }
  'admin.unhide_gig':             AdminEventBase & { gigId: string }
  'admin.force_expire_gig':       AdminEventBase & { gigId: string }
  'admin.hide_exchange':          AdminEventBase & { offerId: string; reason?: string }
  'admin.unhide_exchange':        AdminEventBase & { offerId: string }

  // Phase 3 — dispute mediation
  'admin.open_dispute_thread':    AdminEventBase & { disputeId: string; disputeType: 'gig' | 'exchange' }
  'admin.assign_dispute':         AdminEventBase & { disputeId: string; assignedToId: string; assignedToWallet: string }
  'admin.resolve_dispute':        AdminEventBase & { disputeId: string; disputeType: 'gig' | 'exchange'; winner: string; signature: string }

  // Phase 4 — marketing & announcements
  'admin.create_announcement':    AdminEventBase & { announcementId: string; title: string; priority: number }
  'admin.update_announcement':    AdminEventBase & { announcementId: string; title: string }
  'admin.delete_announcement':    AdminEventBase & { announcementId: string; title: string }
  'admin.broadcast_push':         AdminEventBase & { target: string; targetValue?: string; attemptedCount: number }
  'admin.feature_gig':            AdminEventBase & { gigId: string }
  'admin.unfeature_gig':          AdminEventBase & { gigId: string }

  // Phase 5 — airdrop & finance
  'admin.approve_airdrop':        AdminEventBase & { campaignId: string; campaignName: string }
  'admin.confirm_airdrop_batch':  AdminEventBase & { campaignId: string; batchIndex: number; signature: string; recipientCount: number }
}

class TypedEventEmitter extends EventEmitter {
  emit<K extends keyof AppEvents>(event: K, data: AppEvents[K]): boolean {
    return super.emit(event as string, data)
  }

  on<K extends keyof AppEvents>(event: K, listener: (data: AppEvents[K]) => void): this {
    return super.on(event as string, listener)
  }

  off<K extends keyof AppEvents>(event: K, listener: (data: AppEvents[K]) => void): this {
    return super.off(event as string, listener)
  }
}

// Singleton shared across the process.
export const appEvents = new TypedEventEmitter()
appEvents.setMaxListeners(20)
