/**
 * OfferSellTab — render gating + submit wiring for the manual-rate offer.
 * Verifies the Post CTA is disabled until valid, and that submitting passes the
 * computed fiat total + the default accept (7d/168h) and payment (12h) windows.
 */
import { render, fireEvent, screen } from '@testing-library/react-native'
import { EXCHANGE_PAYMENT_WINDOW_DEFAULT_SECONDS, DEFAULT_ACCEPT_WINDOW_SECONDS } from '@tenda/shared'
import type { ExchangeAssetOption } from '@/hooks/useExchangeAssetOptions'

const OPTION = { chainId: 'solana:devnet', assetId: 'USDC_SOL', symbol: 'USDC', decimals: 6, chainName: 'Solana', walletAddress: 'sol1' } as ExchangeAssetOption
let mockSelection = { options: [OPTION] as ExchangeAssetOption[], option: OPTION as ExchangeAssetOption | null, selectedKey: 'k', select: jest.fn() }
const mockAccount = { id: 'acc1', country: 'NG' }
const mockSubmit = jest.fn()

jest.mock('react-native-unistyles', () => ({ useUnistyles: () => ({ theme: { colors: { surface: { inset: '#eee' }, content: { secondary: '#555' } } } }) }))
jest.mock('../useAssetSelection', () => ({ useAssetSelection: () => mockSelection }))
jest.mock('@/hooks/usePayoutAccounts', () => ({ usePayoutAccounts: () => ({ accounts: [mockAccount], selectedId: 'acc1', selected: mockAccount, setSelectedId: jest.fn(), reload: jest.fn() }) }))
jest.mock('../useOfferSell', () => ({ useOfferSell: () => ({ submitting: false, submit: mockSubmit }) }))
jest.mock('../SellAssetAmount', () => {
  const { TextInput } = require('react-native')
  return { SellAssetAmount: ({ onAmountChange }: { onAmountChange: (t: string) => void }) => <TextInput accessibilityLabel="amount" onChangeText={onAmountChange} /> }
})
jest.mock('../OfferDeadlines', () => ({ OfferDeadlines: () => null }))
jest.mock('../SellPayoutSection', () => ({ SellPayoutSection: () => null }))
jest.mock('@/components/shared/FeeSummary', () => ({ FeeSummary: () => null }))
jest.mock('@/components/ui/Input', () => {
  const { TextInput } = require('react-native')
  return { Input: ({ onChangeText }: { onChangeText: (t: string) => void }) => <TextInput accessibilityLabel="rate" onChangeText={onChangeText} /> }
})
jest.mock('@/components/ui/SectionLabel', () => {
  const { Text } = require('react-native')
  return { SectionLabel: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text> }
})
jest.mock('@/components/ui', () => {
  const { Text, Pressable } = require('react-native')
  return {
    Text: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
    Spacer: () => null,
    Button: ({ children, onPress, disabled }: { children: React.ReactNode; onPress?: () => void; disabled?: boolean }) => (
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} onPress={disabled ? undefined : onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
  }
})

import { OfferSellTab } from '../OfferSellTab'

beforeEach(() => {
  mockSelection = { options: [OPTION], option: OPTION, selectedKey: 'k', select: jest.fn() }
  mockSubmit.mockReset()
})

test('Post is disabled until amount + rate are valid', () => {
  render(<OfferSellTab />)
  const post = screen.getByText('Post offer')
  fireEvent.press(post) // no amount/rate yet
  expect(mockSubmit).not.toHaveBeenCalled()
})

test('submits with the computed fiat total and the default accept + payment windows', () => {
  render(<OfferSellTab />)
  fireEvent.changeText(screen.getByLabelText('amount'), '2')
  fireEvent.changeText(screen.getByLabelText('rate'), '1600')
  fireEvent.press(screen.getByText('Post offer'))

  expect(mockSubmit).toHaveBeenCalledWith({
    option: OPTION,
    amountRaw: '2000000', // 2 USDC @ 6dp
    account: mockAccount,
    fiatTotal: 3200, // 2 * 1600
    currency: 'NGN',
    rate: 1600,
    acceptHours: DEFAULT_ACCEPT_WINDOW_SECONDS / 3600, // 168 (7d)
    paymentWindowSeconds: EXCHANGE_PAYMENT_WINDOW_DEFAULT_SECONDS, // 12h
  })
})
