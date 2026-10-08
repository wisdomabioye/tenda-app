import { WalletError } from './errors'

export interface NativeGasConfirmationState {
  pending: { resolve: () => void; reject: (error: Error) => void } | null
  request: () => Promise<void>
  settle: (accepted: boolean) => void
}

/** Platform-neutral policy; each client supplies its own synchronous state binding. */
export function createNativeGasConfirmationState(
  set: (update: Pick<NativeGasConfirmationState, 'pending'>) => void,
  get: () => NativeGasConfirmationState,
): NativeGasConfirmationState {
  return {
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
  }
}
