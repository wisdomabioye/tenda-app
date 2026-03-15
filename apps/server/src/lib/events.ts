import { EventEmitter } from 'node:events'

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
