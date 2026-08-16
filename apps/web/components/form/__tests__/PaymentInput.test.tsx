/**
 * PaymentInput — display units → raw conversion (the money math), the max
 * clamp from the shared gig bounds, invalid input reading as no budget, and
 * the minimum hint.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { gigAmountBounds } from '@tenda/shared'
import { PaymentInput } from '@/components/form/PaymentInput'

function setup(value = 0) {
  const onChange = vi.fn()
  render(<PaymentInput asset="USDC_SOL" value={value} onChange={onChange} />)
  return { onChange, input: screen.getByLabelText('Budget in USDC') }
}

test('converts display units to raw via the asset decimals', () => {
  const { onChange, input } = setup()
  fireEvent.change(input, { target: { value: '12.5' } })
  expect(onChange).toHaveBeenLastCalledWith(12_500_000)
})

test('clamps at the shared max bound', () => {
  const { onChange, input } = setup()
  const { max_raw } = gigAmountBounds('USDC_SOL')
  fireEvent.change(input, { target: { value: '99999999999' } })
  expect(onChange).toHaveBeenLastCalledWith(max_raw)
})

test('invalid or non-positive input reads as no budget (0), not the last value', () => {
  const { onChange, input } = setup()
  fireEvent.change(input, { target: { value: '12' } })
  fireEvent.change(input, { target: { value: 'abc' } })
  expect(onChange).toHaveBeenLastCalledWith(0)
  fireEvent.change(input, { target: { value: '-5' } })
  expect(onChange).toHaveBeenLastCalledWith(0)
})

test('shows the shared minimum and seeds from an initial raw value', () => {
  const { input } = setup(2_000_000)
  expect((input as HTMLInputElement).value).toBe('2')
  const { min_raw } = gigAmountBounds('USDC_SOL')
  expect(screen.getByText(`Minimum ${min_raw / 10 ** 6} USDC`)).toBeInTheDocument()
})
