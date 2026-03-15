import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { api, ApiClientError } from '@/api/client'
import { ErrorCode } from '@tenda/shared'
import type { SubmitProofInput, ExchangePaidInput } from '@tenda/shared'

const STORAGE_KEY        = 'tenda_pending_sync'
const FAILED_STORAGE_KEY = 'tenda_failed_sync'
const MAX_RETRY_COUNT    = 10

export type PendingSync =
  // Gig actions
  | { id: string; action: 'publish' | 'approve' | 'cancel' | 'accept' | 'refund'; gigId: string; signature: string; createdAt: number; retryCount: number }
  | { id: string; action: 'submit'; gigId: string; signature: string; proofs: SubmitProofInput['proofs']; createdAt: number; retryCount: number }
  // Exchange actions
  | { id: string; action: 'exchange_publish' | 'exchange_accept' | 'exchange_cancel' | 'exchange_confirm'; offerId: string; signature: string; createdAt: number; retryCount: number }
  | { id: string; action: 'exchange_dispute'; offerId: string; signature: string; reason: string; createdAt: number; retryCount: number }
  | { id: string; action: 'exchange_paid'; offerId: string; signature: string; proofs: ExchangePaidInput['proofs']; createdAt: number; retryCount: number }

/** Human-readable label for each pending-sync action. Exhaustive by type — update when adding new actions. */
export const PENDING_SYNC_ACTION_LABEL: Record<PendingSync['action'], string> = {
  publish:          'Publish gig',
  accept:           'Accept gig',
  approve:          'Approve completion',
  cancel:           'Cancel gig',
  refund:           'Claim refund',
  submit:           'Submit proof',
  exchange_publish: 'Publish exchange offer',
  exchange_accept:  'Accept exchange offer',
  exchange_cancel:  'Cancel exchange offer',
  exchange_confirm: 'Confirm exchange payment',
  exchange_dispute: 'Raise exchange dispute',
  exchange_paid:    'Mark exchange as paid',
}

// Distribute Omit over the union so each variant is processed independently.
type PendingSyncEntry = PendingSync extends infer T ? T extends { id: string; createdAt: number; retryCount: number } ? Omit<T, 'id' | 'createdAt' | 'retryCount'> : never : never

interface PendingSyncState {
  queue:       PendingSync[]
  /** Dead-letter queue — items that exceeded MAX_RETRY_COUNT. Signature preserved for manual recovery. */
  failed:      PendingSync[]
  /** True while replayAll is running — prevents concurrent invocations. */
  isReplaying: boolean
  add:           (entry: PendingSyncEntry) => string
  remove:        (id: string) => void
  /** Move a failed item back to the active queue with retryCount reset to 0, then replay immediately. */
  retryFailed:   (id: string) => void
  /** Permanently remove a failed item the user has acknowledged. */
  dismissFailed: (id: string) => void
  clear:         () => Promise<void>
  replayAll:     () => Promise<void>
}

function uuid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

async function loadQueue(): Promise<PendingSync[]> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PendingSync[]) : []
  } catch {
    return []
  }
}

async function loadFailed(): Promise<PendingSync[]> {
  try {
    const raw = await SecureStore.getItemAsync(FAILED_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PendingSync[]) : []
  } catch {
    return []
  }
}

async function saveQueue(queue: PendingSync[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // Non-fatal — in-memory state still intact
  }
}

async function saveFailed(failed: PendingSync[]): Promise<void> {
  try {
    if (failed.length === 0) {
      await SecureStore.deleteItemAsync(FAILED_STORAGE_KEY)
    } else {
      await SecureStore.setItemAsync(FAILED_STORAGE_KEY, JSON.stringify(failed))
    }
  } catch {
    // Non-fatal
  }
}

export const usePendingSyncStore = create<PendingSyncState>((set, get) => ({
  queue:       [],
  failed:      [],
  isReplaying: false,

  add: (entry: PendingSyncEntry) => {
    const id   = uuid()
    const item = { ...entry, id, createdAt: Date.now(), retryCount: 0 } as PendingSync
    const queue = [...get().queue, item]
    set({ queue })
    saveQueue(queue).catch(() => {})
    return id
  },

  remove: (id) => {
    const queue = get().queue.filter((item) => item.id !== id)
    set({ queue })
    saveQueue(queue).catch(() => {})
  },

  retryFailed: (id) => {
    const item = get().failed.find((i) => i.id === id)
    if (!item) return
    const failed = get().failed.filter((i) => i.id !== id)
    const queue  = [...get().queue, { ...item, retryCount: 0 }]
    set({ queue, failed })
    saveQueue(queue).catch(() => {})
    saveFailed(failed).catch(() => {})
    // Replay immediately so the user sees an instant retry rather than waiting
    // for the next foreground sync event.
    void get().replayAll()
  },

  dismissFailed: (id) => {
    const failed = get().failed.filter((i) => i.id !== id)
    set({ failed })
    saveFailed(failed).catch(() => {})
  },

  clear: async () => {
    set({ queue: [], failed: [] })
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEY)
      await SecureStore.deleteItemAsync(FAILED_STORAGE_KEY)
    } catch {
      // Non-fatal
    }
  },

  replayAll: async () => {
    // Re-entrancy guard — prevent concurrent invocations from processing the same items.
    if (get().isReplaying) return
    set({ isReplaying: true })

    try {
    // Merge disk state with in-memory state. In-memory is authoritative for items
    // that exist in both (e.g. retryCount just incremented). Disk-only items are
    // added back (e.g. recovered after a crash before the in-memory store hydrated).
    const [diskQueue, diskFailed] = await Promise.all([loadQueue(), loadFailed()])

    // Capture both queues once to avoid a data race where get().queue differs
    // between building memIds and building merged (e.g. add() called mid-await).
    const memQueue     = get().queue
    const memFailed    = get().failed
    const memIds       = new Set(memQueue.map((i) => i.id))
    const memFailedIds = new Set(memFailed.map((i) => i.id))
    const merged       = [...memQueue,  ...diskQueue.filter((i) => !memIds.has(i.id))]
    const mergedFailed = [...memFailed, ...diskFailed.filter((i) => !memFailedIds.has(i.id))]

    set({ queue: merged, failed: mergedFailed })

    const toProcess = [...merged]
    for (const entry of toProcess) {
      if (entry.retryCount >= MAX_RETRY_COUNT) {
        // Move to dead-letter instead of discarding — signature preserved for manual recovery.
        const queue  = get().queue.filter((i) => i.id !== entry.id)
        const failed = [...get().failed.filter((i) => i.id !== entry.id), entry]
        set({ queue, failed })
        saveQueue(queue).catch(() => {})
        saveFailed(failed).catch(() => {})
        continue
      }

      try {
        if (entry.action === 'publish') {
          await api.gigs.publish({ id: entry.gigId }, { signature: entry.signature })
        } else if (entry.action === 'approve') {
          await api.gigs.approve({ id: entry.gigId }, { signature: entry.signature })
        } else if (entry.action === 'cancel') {
          await api.gigs.delete({ id: entry.gigId }, { signature: entry.signature })
        } else if (entry.action === 'accept') {
          await api.gigs.accept({ id: entry.gigId }, { signature: entry.signature })
        } else if (entry.action === 'refund') {
          await api.gigs.refund({ id: entry.gigId }, { signature: entry.signature })
        } else if (entry.action === 'submit') {
          await api.gigs.submit({ id: entry.gigId }, { signature: entry.signature, proofs: entry.proofs })
        } else if (entry.action === 'exchange_publish') {
          await api.exchange.publish({ id: entry.offerId }, { signature: entry.signature })
        } else if (entry.action === 'exchange_accept') {
          await api.exchange.accept({ id: entry.offerId }, { signature: entry.signature })
        } else if (entry.action === 'exchange_cancel') {
          await api.exchange.cancel({ id: entry.offerId }, { signature: entry.signature })
        } else if (entry.action === 'exchange_confirm') {
          await api.exchange.confirm({ id: entry.offerId }, { signature: entry.signature })
        } else if (entry.action === 'exchange_dispute') {
          await api.exchange.dispute({ id: entry.offerId }, { signature: entry.signature, reason: entry.reason })
        } else if (entry.action === 'exchange_paid') {
          await api.exchange.paid({ id: entry.offerId }, { signature: entry.signature, proofs: entry.proofs })
        }
        get().remove(entry.id)
      } catch (err) {
        // 409 DUPLICATE_SIGNATURE = already recorded on-chain — treat as success.
        // Only remove for this specific code; other 409s (e.g. GIG_WRONG_STATUS) are real errors.
        if (err instanceof ApiClientError && err.statusCode === 409 && err.error === ErrorCode.DUPLICATE_SIGNATURE) {
          get().remove(entry.id)
          continue
        }
        // Network/server error: increment retry count, keep in active queue
        const updated = get().queue.map((item) =>
          item.id === entry.id ? { ...item, retryCount: item.retryCount + 1 } : item,
        )
        set({ queue: updated })
        saveQueue(updated).catch(() => {})
      }
    }
    } finally {
      set({ isReplaying: false })
    }
  },
}))
