import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { api } from '@/api/client'
import type { SubmitProofInput } from '@tenda/shared'

const STORAGE_KEY = 'tenda_pending_sync'
const MAX_RETRY_COUNT = 10

export type PendingSync =
  | { id: string; action: 'publish' | 'approve' | 'cancel' | 'accept' | 'refund'; gigId: string; signature: string; createdAt: number; retryCount: number }
  | { id: string; action: 'submit'; gigId: string; signature: string; proofs: SubmitProofInput['proofs']; createdAt: number; retryCount: number }

// Distribute Omit over the union so each variant is processed independently.
type PendingSyncEntry = PendingSync extends infer T ? T extends { id: string; createdAt: number; retryCount: number } ? Omit<T, 'id' | 'createdAt' | 'retryCount'> : never : never

interface PendingSyncState {
  queue: PendingSync[]
  add: (entry: PendingSyncEntry) => string
  remove: (id: string) => void
  clear: () => Promise<void>
  replayAll: () => Promise<void>
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

async function saveQueue(queue: PendingSync[]) {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // Non-fatal — in-memory state still intact
  }
}

export const usePendingSyncStore = create<PendingSyncState>((set, get) => ({
  queue: [],

  add: (entry: PendingSyncEntry) => {
    const id = uuid()
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

  clear: async () => {
    set({ queue: [] })
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEY)
    } catch {
      // Non-fatal
    }
  },

  replayAll: async () => {
    // Merge disk state with in-memory state. In-memory is authoritative for items
    // that exist in both (e.g. retryCount just incremented). Disk-only items are
    // added back (e.g. recovered after a crash before the in-memory store hydrated).
    const diskQueue = await loadQueue()
    const memIds    = new Set(get().queue.map((i) => i.id))
    const merged    = [...get().queue, ...diskQueue.filter((i) => !memIds.has(i.id))]
    set({ queue: merged })

    const toProcess = [...merged]
    for (const entry of toProcess) {
      if (entry.retryCount >= MAX_RETRY_COUNT) continue

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
        }
        get().remove(entry.id)
      } catch (err: any) {
        // 409 DUPLICATE_SIGNATURE = already recorded — treat as success
        if (err?.statusCode === 409) {
          get().remove(entry.id)
          continue
        }
        // Network/other error: increment retry count
        const updated = get().queue.map((item) =>
          item.id === entry.id ? { ...item, retryCount: item.retryCount + 1 } : item,
        )
        set({ queue: updated })
        saveQueue(updated).catch(() => {})
      }
    }
  },
}))
