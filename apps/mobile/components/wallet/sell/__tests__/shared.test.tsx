/**
 * sell/shared — QuoteSummary + UnavailableNotice. Covers the fee (Free vs
 * amount) and expiry (valid countdown vs expired) branches, and the notice.
 */
import { render, screen } from '@testing-library/react-native'

jest.mock('react-native-unistyles', () => ({
  useUnistyles: () => ({ theme: { colors: { surface: { card: '#fff', inset: '#eee' }, border: { default: '#ddd' }, content: { secondary: '#555', tertiary: '#999' } } } }),
}))
jest.mock('@/components/ui', () => {
  const { Text } = require('react-native')
  return { Text: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text> }
})
jest.mock('@/theme/tokens', () => ({ spacing: { md: 16 } }))

import { QuoteSummary, UnavailableNotice } from '../shared'

test('QuoteSummary shows a fee amount and a live countdown when valid', () => {
  render(<QuoteSummary rate={1600} fee={50} fiatAmount={16000} currencySymbol="₦" assetSymbol="USDC" expiresIn={125} />)
  expect(screen.getByText('₦1,600 / USDC')).toBeTruthy() // rate row
  expect(screen.getByText('₦50')).toBeTruthy() // fee row (non-zero → amount, not "Free")
  expect(screen.getByText('₦16,000')).toBeTruthy() // you receive
  expect(screen.getByText('Quote valid for 2:05')).toBeTruthy()
})

test('QuoteSummary shows "Free" and "expired" on a zero fee / lapsed quote', () => {
  render(<QuoteSummary rate={1600} fee={0} fiatAmount={16000} currencySymbol="₦" assetSymbol="USDC" expiresIn={0} />)
  expect(screen.getByText('Free')).toBeTruthy()
  expect(screen.getByText('Quote expired, amounts refresh on change')).toBeTruthy()
})

test('UnavailableNotice renders its copy', () => {
  render(<UnavailableNotice copy="No route available." />)
  expect(screen.getByText('No route available.')).toBeTruthy()
})
