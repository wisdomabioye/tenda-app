/**
 * /wallet/buy-sell is now a single Sell / cash-out flow — Buy (onramp) was
 * retired. Verifies the screen renders the sell flow with no Buy tab.
 */
import { render, screen } from '@testing-library/react-native'

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }))
jest.mock('@/components/ui', () => {
  const { View, Text } = require('react-native')
  return {
    ScreenContainer: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    Header: ({ title }: { title: string }) => <Text>{title}</Text>,
  }
})
jest.mock('@/components/wallet/buy-sell/SellTab', () => {
  const { Text } = require('react-native')
  return { SellTab: () => <Text>SELL_FLOW</Text> }
})

import SellScreen from '../buy-sell'

test('renders the sell flow and no Buy tab', () => {
  render(<SellScreen />)
  expect(screen.getByText('Sell / Cash out')).toBeTruthy()
  expect(screen.getByText('SELL_FLOW')).toBeTruthy()
  expect(screen.queryByText('Buy')).toBeNull()
})
