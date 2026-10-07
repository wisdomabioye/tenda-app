import { create } from 'zustand'
import { WalletError } from '@tenda/shared'

interface ConfirmationState {
  pending: { resolve: () => void; reject: (error: Error) => void } | null
  request: () => Promise<void>
  settle: (accepted: boolean) => void
}

/** Bridge imperative wallet transport to the app's shared confirmation UI. */
export const useNativeGasConfirmation = create<ConfirmationState>((set, get) => ({
  pending: null,
  request: () => {
    if (get().pending !== null) {
      return Promise.reject(new WalletError('network', 'A network fee confirmation is already open'))
    }
    return new Promise<void>((resolve, reject) => set({ pending: { resolve, reject } }))
  },
  settle: accepted => {
    const pending = get().pending
    set({ pending: null })
    if (pending === null) return
    if (accepted) pending.resolve()
    else pending.reject(new WalletError('declined', 'CELO network fee payment was declined'))
  },
}))
