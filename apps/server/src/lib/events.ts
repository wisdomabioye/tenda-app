import { EventEmitter } from 'node:events'

// ── Typed event map ────────────────────────────────────────────────────────

export interface AppEvents {
  'gig.accepted':   { gigId: string; posterId: string; workerId: string; title: string }
  'gig.submitted':  { gigId: string; posterId: string; workerId: string; title: string }
  'gig.approved':   { gigId: string; posterId: string; workerId: string; title: string }
  'gig.disputed':   { gigId: string; posterId: string; workerId: string; raisedById: string; title: string }
  'gig.resolved':   { gigId: string; posterId: string; workerId: string; winner: string; title: string }
  'gig.created':    { gigId: string; city: string; category: string; title: string }
  'message.sent':   { conversationId: string; senderId: string; recipientId: string; preview: string }
  'review.submitted': { gigId: string; reviewerId: string; revieweeId: string; score: number; title: string }
  'proof.added':    { gigId: string; posterId: string; workerId: string; title: string }
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
