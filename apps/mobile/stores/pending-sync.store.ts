import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { api } from '@/api/client'

const STORAGE_KEY = 'tenda_pending_sync'
const MAX_RETRY_COUNT = 10

export interface PendingSync {
  id: string
  gigId: string
  action: 'publish' | 'approve' | 'cancel' | 'accept' | 'refund'
  signature: string
  createdAt: number
  retryCount: number
}

interface PendingSyncState {
  queue: PendingSync[]
  add: (entry: Omit<PendingSync, 'id' | 'createdAt' | 'retryCount'>) => string
  remove: (id: string) => void
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

  add: (entry) => {
    const id = uuid()
    const item: PendingSync = { ...entry, id, createdAt: Date.now(), retryCount: 0 }
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

  replayAll: async () => {
    const queue = await loadQueue()
    set({ queue })

    const toProcess = [...queue]
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
