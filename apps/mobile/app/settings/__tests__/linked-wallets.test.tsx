/**
 * Linked-wallets screen (Stage 4 — EVM link parity). "Add another wallet"
 * opens the shared WalletPicker; selecting an adapter runs linkWalletWith and
 * surfaces the outcome via toasts. Covers success, decline, no-wallet, and
 * server-error branches.
 */
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  // Fire the focus callback once so refreshMe runs on mount.
  useFocusEffect: (cb: () => void) => cb(),
}))

jest.mock('react-native-unistyles', () => ({
  useUnistyles: () => ({
    theme: {
      colors: {
        content: { secondary: '#333', tertiary: '#777' },
        border: { subtle: '#ccc' },
        brand: { primary: '#00f', primarySurface: '#eee' },
        feedback: { danger: { base: '#f00', surface: '#fee' } },
      },
    },
  }),
}))

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))

jest.mock('@/components/ui', () => {
  const { Pressable, Text, View } = require('react-native')
  return {
    ScreenContainer: ({ children }: { children: React.ReactNode }) => children,
    Header: () => null,
    Text: Text,
    BottomSheet: ({ children, visible }: { children: React.ReactNode; visible: boolean }) =>
      visible ? <View>{children}</View> : null,
    Button: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) => (
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
    showToast: jest.fn(),
  }
})

jest.mock('@/components/onboarding/WalletCard', () => {
  const { Pressable, Text } = require('react-native')
  return {
    WalletCard: ({
      wallet,
      onManage,
    }: {
      wallet: { address: string }
      onManage: () => void
    }) => (
      <Pressable accessibilityRole="button" onPress={onManage}>
        <Text>{`manage-${wallet.address}`}</Text>
      </Pressable>
    ),
  }
})

const FAKE_ADAPTER = { id: 'metamask', name: 'MetaMask' }
jest.mock('@/wallet/picker', () => {
  const { Pressable, Text } = require('react-native')
  return {
    WalletPicker: ({
      visible,
      onSelect,
    }: {
      visible: boolean
      onSelect: (a: typeof FAKE_ADAPTER) => void
    }) => (
      <>
        {visible ? <Text>picker-visible</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => onSelect(FAKE_ADAPTER)}>
          <Text>pick-wallet</Text>
        </Pressable>
      </>
    ),
  }
})

jest.mock('@/wallet/auth', () => ({ linkWalletWith: jest.fn() }))

jest.mock('@/api/client', () => {
  class ApiClientError extends Error {
    code?: string
    constructor(statusCode: number, error: string, message: string, code?: string) {
      super(message)
      this.code = code
    }
  }
  return {
    api: { auth: { setPrimaryWallet: jest.fn(), unlinkWallet: jest.fn() } },
    ApiClientError,
  }
})

jest.mock('@/stores/auth.store', () => {
  const state: { wallets: LinkedWallet[]; refreshMe: jest.Mock } = {
    wallets: [],
    refreshMe: jest.fn(async () => {}),
  }
  const useAuthStore = (selector: (s: typeof state) => unknown) => selector(state)
  useAuthStore.getState = () => state
  return { useAuthStore }
})

import { Alert } from 'react-native'
import LinkedWalletsScreen from '@/app/settings/linked-wallets'
import { linkWalletWith } from '@/wallet/auth'
import { useAuthStore } from '@/stores/auth.store'
import { api, ApiClientError } from '@/api/client'
import { WalletError } from '@/wallet/errors'
import { ErrorCode, type LinkedWallet } from '@tenda/shared'
import { showToast } from '@/components/ui'

const mockShowToast = showToast as jest.Mock
const linkMock = linkWalletWith as jest.Mock
const setPrimaryMock = api.auth.setPrimaryWallet as jest.Mock
const unlinkMock = api.auth.unlinkWallet as jest.Mock
const authState = useAuthStore.getState()
const refreshMe = authState.refreshMe as jest.Mock

beforeEach(() => {
  authState.wallets = []
})

function openPickerAndSelect() {
  fireEvent.press(screen.getByText('Add another wallet'))
  fireEvent.press(screen.getByText('pick-wallet'))
}

describe('LinkedWalletsScreen — add wallet', () => {
  it('opens the picker on "Add another wallet"', () => {
    render(<LinkedWalletsScreen />)
    expect(screen.queryByText('picker-visible')).toBeNull()
    fireEvent.press(screen.getByText('Add another wallet'))
    expect(screen.getByText('picker-visible')).toBeTruthy()
  })

  it('links the selected adapter and refreshes on success', async () => {
    linkMock.mockResolvedValue({ namespace: 'eip155', address: '0xAbc' })
    render(<LinkedWalletsScreen />)
    refreshMe.mockClear()
    openPickerAndSelect()
    await waitFor(() => expect(linkMock).toHaveBeenCalledWith(FAKE_ADAPTER))
    expect(mockShowToast).toHaveBeenCalledWith('success', 'Wallet linked')
    expect(refreshMe).toHaveBeenCalled()
  })

  it('toasts when the wallet prompt is closed (decline → null)', async () => {
    linkMock.mockResolvedValue(null)
    render(<LinkedWalletsScreen />)
    openPickerAndSelect()
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('error', 'Wallet prompt was closed'),
    )
  })

  it('toasts a friendly message when no wallet app is installed', async () => {
    linkMock.mockRejectedValue(new WalletError('no_wallet', 'none'))
    render(<LinkedWalletsScreen />)
    openPickerAndSelect()
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith('error', 'No wallet app installed'),
    )
  })

  it('surfaces a server error message verbatim', async () => {
    linkMock.mockRejectedValue(new ApiClientError(409, 'Conflict', 'already linked'))
    render(<LinkedWalletsScreen />)
    openPickerAndSelect()
    await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('error', 'already linked'))
  })
})

describe('LinkedWalletsScreen — manage wallets', () => {
  const PRIMARY: LinkedWallet = {
    chain_ns: 'solana',
    address: '0xPrimary',
    is_primary: true,
    verified_at: '2026-01-01T00:00:00Z',
  }
  const SECONDARY: LinkedWallet = {
    chain_ns: 'eip155',
    address: '0xSecondary',
    is_primary: false,
    verified_at: '2026-01-01T00:00:00Z',
  }

  it('renders a card per linked wallet', () => {
    authState.wallets = [PRIMARY, SECONDARY]
    render(<LinkedWalletsScreen />)
    expect(screen.getByText('manage-0xPrimary')).toBeTruthy()
    expect(screen.getByText('manage-0xSecondary')).toBeTruthy()
  })

  it('sets a non-primary wallet as primary', async () => {
    authState.wallets = [SECONDARY]
    setPrimaryMock.mockResolvedValue({})
    render(<LinkedWalletsScreen />)
    fireEvent.press(screen.getByText('manage-0xSecondary'))
    fireEvent.press(screen.getByText('Make primary'))
    await waitFor(() =>
      expect(setPrimaryMock).toHaveBeenCalledWith({ chain_ns: 'eip155', address: '0xSecondary' }),
    )
    expect(mockShowToast).toHaveBeenCalledWith('success', 'Primary wallet updated')
  })

  it('confirms then unlinks a wallet', async () => {
    authState.wallets = [SECONDARY]
    unlinkMock.mockResolvedValue({})
    // Auto-confirm the destructive Alert button.
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const confirm = buttons?.find((b) => b.style === 'destructive')
      confirm?.onPress?.()
    })
    render(<LinkedWalletsScreen />)
    fireEvent.press(screen.getByText('manage-0xSecondary'))
    fireEvent.press(screen.getByText('Unlink wallet'))
    await waitFor(() =>
      expect(unlinkMock).toHaveBeenCalledWith({ chain_ns: 'eip155', address: '0xSecondary' }),
    )
    expect(mockShowToast).toHaveBeenCalledWith('success', 'Wallet unlinked')
    alertSpy.mockRestore()
  })

  it('explains the WALLET_IN_USE guard on unlink failure', async () => {
    authState.wallets = [SECONDARY]
    unlinkMock.mockRejectedValue(new ApiClientError(409, 'Conflict', 'in use', ErrorCode.WALLET_IN_USE))
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.()
    })
    render(<LinkedWalletsScreen />)
    fireEvent.press(screen.getByText('manage-0xSecondary'))
    fireEvent.press(screen.getByText('Unlink wallet'))
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith(
        'error',
        'This wallet is part of an active escrow — finish or cancel it first',
      ),
    )
    alertSpy.mockRestore()
  })
})
