/**
 * PayoutAccountPicker — selectable payout-account list. Verifies the empty
 * state offers "add", populated state lists rows with radio semantics, and
 * taps report the chosen id.
 */
import { render, fireEvent, screen } from '@testing-library/react-native'
import type { BankAccountSummary } from '@tenda/shared'

jest.mock('react-native-unistyles', () => ({
  useUnistyles: () => ({
    theme: { colors: {
      surface: { card: '#fff' }, border: { default: '#ddd' },
      brand: { primary: '#00f' }, content: { secondary: '#555', tertiary: '#999' },
    } },
  }),
}))
jest.mock('lucide-react-native', () => ({ Landmark: () => null, Smartphone: () => null }))
jest.mock('@/components/ui', () => {
  const { Text, Pressable } = require('react-native')
  return {
    Text: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
    Button: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => (
      <Pressable accessibilityRole="button" onPress={onPress}><Text>{children}</Text></Pressable>
    ),
  }
})

import { PayoutAccountPicker } from '../PayoutAccountPicker'

function acc(id: string): BankAccountSummary {
  return {
    id, country: 'NG', kind: 'bank', bank_code: '058',
    account_number_masked: '•••• 6789', account_name: id.toUpperCase(),
    is_default: false, verified: false, created_at: '',
  }
}

test('empty list shows the add-account affordance and fires it', () => {
  const onAdd = jest.fn()
  render(<PayoutAccountPicker accounts={[]} selectedId={null} onSelect={jest.fn()} onAddAccount={onAdd} />)
  fireEvent.press(screen.getByText('Add a payout account'))
  expect(onAdd).toHaveBeenCalled()
})

test('loading (null) renders neither rows nor the add button', () => {
  render(<PayoutAccountPicker accounts={null} selectedId={null} onSelect={jest.fn()} onAddAccount={jest.fn()} />)
  expect(screen.queryByText('Add a payout account')).toBeNull()
})

test('populated list renders rows; a tap selects by id', () => {
  const onSelect = jest.fn()
  render(
    <PayoutAccountPicker accounts={[acc('a'), acc('b')]} selectedId="a" onSelect={onSelect} onAddAccount={jest.fn()} />,
  )
  expect(screen.getByText('A')).toBeTruthy()
  const rowB = screen.getByText('B')
  fireEvent.press(rowB)
  expect(onSelect).toHaveBeenCalledWith('b')
})

test('the selected row is flagged selected for a11y', () => {
  render(
    <PayoutAccountPicker accounts={[acc('a')]} selectedId="a" onSelect={jest.fn()} onAddAccount={jest.fn()} />,
  )
  const radios = screen.UNSAFE_getAllByProps({ accessibilityRole: 'radio' })
  expect(radios[0].props.accessibilityState).toEqual({ selected: true })
})
