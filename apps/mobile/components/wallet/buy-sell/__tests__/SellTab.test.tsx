/**
 * SellTab — the offramp/cash-out flow. Focus: the CTA-gating fix. The
 * "Confirm cash-out" button must appear as soon as an amount + payout account
 * are valid, WITHOUT waiting on a live quote (the old bug hid it until a quote
 * arrived). A fresh quote is still required to actually submit.
 */
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native'

// --- mutable quote state the hook mock returns ---
type QuoteState = { quote: unknown; expiresIn: number; loading: boolean; error: string | null }
const quoteState: QuoteState = { quote: null, expiresIn: 0, loading: true, error: null }

jest.mock('react-native-unistyles', () => ({
  useUnistyles: () => ({
    theme: { colors: {
      content: { tertiary: '#999', secondary: '#555' },
      surface: { card: '#fff' }, border: { default: '#ddd' },
      brand: { primary: '#00f' }, feedback: { danger: { base: '#f00' } },
    } },
  }),
}))
jest.mock('lucide-react-native', () => ({ Landmark: () => null, Smartphone: () => null }))
jest.mock('@/hooks/useFiatQuote', () => ({ useFiatQuote: () => quoteState }))
jest.mock('@/hooks/useExchangeAssetOptions', () => ({
  useExchangeAssetOptions: () => ([
    { chainId: 'solana:devnet', assetId: 'USDC_SOL', symbol: 'USDC', decimals: 6, chainName: 'Solana Devnet', walletAddress: 'sol1' },
  ]),
}))
jest.mock('@/components/exchange/AssetChainPicker', () => ({
  AssetChainPicker: () => null,
  optionKey: (o: { chainId: string; assetId: string }) => `${o.chainId}:${o.assetId}`,
}))
jest.mock('@/components/wallet/buy-sell/shared', () => {
  const { Text } = require('react-native')
  return {
    tabBodyStyle: {},
    QuoteSummary: () => <Text>QUOTE_SUMMARY</Text>,
    UnavailableNotice: ({ copy }: { copy: string }) => <Text>{copy}</Text>,
  }
})
jest.mock('@/components/ui', () => {
  const { Text, Pressable } = require('react-native')
  return {
    Text: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
    Button: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => (
      <Pressable accessibilityRole="button" onPress={onPress}><Text>{children}</Text></Pressable>
    ),
    showToast: jest.fn(),
  }
})
jest.mock('@/components/ui/Input', () => {
  const { TextInput } = require('react-native')
  return { Input: ({ value, onChangeText, placeholder }: { value: string; onChangeText: (t: string) => void; placeholder?: string }) => (
    <TextInput placeholder={placeholder} value={value} onChangeText={onChangeText} />
  ) }
})
jest.mock('@/components/ui/SectionLabel', () => {
  const { Text } = require('react-native')
  return { SectionLabel: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text> }
})
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn() }) }))

const mockOfframp = jest.fn().mockResolvedValue({ instruction: { kind: 'p2p', offer_id: 'off-1' }, intent_id: 'i1' })
jest.mock('@/api/client', () => ({
  api: {
    fiat: {
      bankAccounts: () => Promise.resolve([
        { id: 'acc1', country: 'NG', kind: 'bank', bank_code: '058', account_number_masked: '•••• 6789', account_name: 'ADAEZE', is_default: true, verified: false, created_at: '' },
      ]),
      offramp: (...args: unknown[]) => mockOfframp(...args),
    },
  },
  ApiClientError: class extends Error {},
}))

import { SellTab } from '../SellTab'
import { showToast } from '@/components/ui'

beforeEach(() => {
  quoteState.quote = null
  quoteState.expiresIn = 0
  quoteState.loading = true
  quoteState.error = null
  mockOfframp.mockClear()
  ;(showToast as jest.Mock).mockClear()
})

test('the Confirm CTA appears on a valid amount + account even with NO quote yet', async () => {
  render(<SellTab />)
  await screen.findByText('ADAEZE') // account auto-selected once loaded
  fireEvent.changeText(screen.getByPlaceholderText('2.5'), '10')
  // No quote in state, but the button must be present (the bug fix).
  expect(await screen.findByText('Confirm cash-out')).toBeTruthy()
  expect(screen.queryByText('QUOTE_SUMMARY')).toBeNull()
})

test('submitting without a fresh quote is blocked and nudges instead of calling offramp', async () => {
  render(<SellTab />)
  await screen.findByText('ADAEZE')
  fireEvent.changeText(screen.getByPlaceholderText('2.5'), '10')
  fireEvent.press(await screen.findByText('Confirm cash-out'))
  await waitFor(() => expect(showToast).toHaveBeenCalledWith('info', expect.stringMatching(/latest price/i)))
  expect(mockOfframp).not.toHaveBeenCalled()
})

test('with a fresh quote, Confirm calls offramp with the quote intent + account', async () => {
  quoteState.quote = { intent_id: 'q-int', rate: 1600, fee_amount: 0, fiat_amount: 16000, expires_at: new Date(Date.now() + 300000).toISOString() }
  quoteState.expiresIn = 300
  quoteState.loading = false
  render(<SellTab />)
  await screen.findByText('ADAEZE')
  fireEvent.changeText(screen.getByPlaceholderText('2.5'), '10')
  expect(await screen.findByText('QUOTE_SUMMARY')).toBeTruthy()
  fireEvent.press(screen.getByText('Confirm cash-out'))
  await waitFor(() => expect(mockOfframp).toHaveBeenCalledWith({ intent_id: 'q-int', bank_account_id: 'acc1' }))
})
