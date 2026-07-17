import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { api } from '@/api/client'
import type { ChainRegistryEntry } from '@tenda/shared'

// Versioned: bump when ChainRegistryEntry gains REQUIRED fields, so a stale
// persisted snapshot (older shape) is ignored instead of rehydrating as the
// new type with undefined fields. v2 = escrow_address + supports_permit.
const STORAGE_KEY = 'chain_registry_v2'

/**
 * Cached enabled-chain registry (id, namespace, display name, and each asset's
 * symbol/decimals/token_address). The SINGLE client-side source of token
 * addresses, the wallet balance readers consume it so a USDC address change is
 * a server config/seed edit, never an app change. Persisted to SecureStore for
 * a fast first paint; refreshed from `/v1/platform/chains` on app start.
 */
interface ChainRegistryState {
  /** null until loaded from cache or network. */
  chains: ChainRegistryEntry[] | null
  loadPersisted: () => Promise<void>
  /** Fetch fresh; de-duped + cached. Never throws (keeps the last good value). */
  fetch: () => Promise<void>
}

let inflight: Promise<void> | null = null

export const useChainRegistryStore = create<ChainRegistryState>((set, get) => ({
  chains: null,

  loadPersisted: async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY)
      if (!raw) return
      // Don't clobber a fresher network result that already landed.
      if (get().chains === null) set({ chains: JSON.parse(raw) as ChainRegistryEntry[] })
    } catch {
      // Ignore corrupt cache.
    }
  },

  fetch: async () => {
    if (inflight) return inflight
    inflight = api.platform
      .chains()
      .then(async ({ data }) => {
        set({ chains: data })
        await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(data))
      })
      .catch(() => {
        // Keep previous value, never crash on a registry fetch failure.
      })
      .finally(() => {
        inflight = null
      })
    return inflight
  },
}))

/**
 * One enabled chain by CAIP-2 id, or null when the registry hasn't loaded yet
 * or doesn't carry it. Pure so both read styles share it: reactive consumers
 * pass the value from `useChainRegistryStore(s => s.chains)`, one-shot ones
 * pass `useChainRegistryStore.getState().chains`.
 */
export function selectChainById(
  chains: ChainRegistryEntry[] | null,
  id: string,
): ChainRegistryEntry | null {
  return chains?.find((c) => c.id === id) ?? null
}
