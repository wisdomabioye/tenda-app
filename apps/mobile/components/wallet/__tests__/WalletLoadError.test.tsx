/**
 * WalletLoadError, shown when the linked-wallet LOAD failed (distinct from
 * "no wallet linked"). Renders the failure prompt and fires the retry handler —
 * so a transient /v1/users/me blip no longer reads as "no wallet".
 */
import { render, fireEvent, screen } from '@testing-library/react-native'

jest.mock('react-native-unistyles', () => ({
  useUnistyles: () => ({
    theme: {
      colors: {
        brand: { primary: '#0a0', onPrimary: '#fff' },
        surface: { card: '#f6f6f6', background: '#fff' },
        border: { subtle: '#eee' },
        content: { primary: '#000', secondary: '#333' },
      },
    },
  }),
}))
jest.mock('lucide-react-native', () => ({ CloudOff: () => null }))
jest.mock('@/components/ui', () => {
  const { Text } = require('react-native')
  return { Text: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text> }
})

import { WalletLoadError } from '@/components/wallet/WalletLoadError'

test('renders the load-failure prompt and fires the retry handler', () => {
  const onRetry = jest.fn()
  render(<WalletLoadError onRetry={onRetry} />)
  expect(screen.getByText('Couldn’t load your wallets')).toBeTruthy()
  fireEvent.press(screen.getByText('Try again'))
  expect(onRetry).toHaveBeenCalledTimes(1)
})
