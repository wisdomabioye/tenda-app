import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { WalletPicker } from './picker'
import { useAuthStore } from '@/stores/auth.store'
import { adapters, requireAdapter } from './adapters/registry'
import type { WalletAdapter } from './adapters/types'
import type {
  SignMessageResult,
  SpikeAccount,
  SpikeWalletAPI,
} from './types'

const WalletSpikeContext = createContext<SpikeWalletAPI | null>(null)

/**
 * CO3: the evm-tx dispatch path (wallet/dispatch.ts) runs outside React
 * and needs the CONNECTED eip155 account as `from` — publish it to the
 * auth store whenever the spike session changes.
 */
function publishEvmSession(account: SpikeAccount | null): void {
  useAuthStore
    .getState()
    .setEvmAddress(account !== null && account.namespace === 'eip155' ? account.address : null)
}

export function WalletSpikeProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<SpikeAccount | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [pickerVisible, setPickerVisible] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (const adapter of adapters) {
        try {
          const restored = await adapter.getRestoredAccount()
          if (cancelled) return
          if (restored) {
            setAccount(restored)
            publishEvmSession(restored)
            return
          }
        } catch {
          // Restoration is best-effort — never block app launch on a stale session.
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const openConnectModal = useCallback(() => setPickerVisible(true), [])

  const handleSelectWallet = useCallback(async (adapter: WalletAdapter) => {
    setPickerVisible(false)
    setIsConnecting(true)
    setLastError(null)
    try {
      const connected = await adapter.connect()
      setAccount(connected)
      publishEvmSession(connected)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'connect failed'
      console.warn('[wallet] connect failed:', err)
      setLastError(msg)
    } finally {
      setIsConnecting(false)
    }
  }, [])

  const disconnect = useCallback(async () => {
    if (!account) return
    try {
      await requireAdapter(account.walletId).disconnect()
    } catch (err) {
      console.warn('[wallet] disconnect error:', err)
    }
    setAccount(null)
    publishEvmSession(null)
  }, [account])

  const signMessage = useCallback(
    async (message: string): Promise<SignMessageResult> => {
      if (!account) throw new Error('No wallet connected')
      return requireAdapter(account.walletId).signMessage(account, message)
    },
    [account],
  )

  const api = useMemo<SpikeWalletAPI>(
    () => ({
      account,
      isConnected: account !== null,
      isConnecting,
      lastError,
      openConnectModal,
      disconnect,
      signMessage,
    }),
    [account, isConnecting, lastError, openConnectModal, disconnect, signMessage],
  )

  return (
    <WalletSpikeContext.Provider value={api}>
      {children}
      <WalletPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handleSelectWallet}
      />
    </WalletSpikeContext.Provider>
  )
}

export function useSpikeWallet(): SpikeWalletAPI {
  const ctx = useContext(WalletSpikeContext)
  if (!ctx) {
    throw new Error('useSpikeWallet must be used inside <WalletSpikeProvider>')
  }
  return ctx
}
