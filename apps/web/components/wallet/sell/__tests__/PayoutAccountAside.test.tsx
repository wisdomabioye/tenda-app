/**
 * Where the money lands.
 *
 * The load-bearing distinction is loading vs empty: "add a payout account"
 * shown to someone who has three is a lie with a button on it, so a null list
 * shimmers and only `[]` offers to add one.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { BankAccountSummary } from '@tenda/shared'
import { PayoutAccountAside } from '@/components/wallet/sell/PayoutAccountAside'
import { SELL_COPY } from '@/components/wallet/sell/copy'

const acct = (over: Partial<BankAccountSummary> = {}): BankAccountSummary => ({
  id: 'acc-1',
  country: 'NG',
  kind: 'bank',
  bank_code: '058',
  account_number_masked: '••••6789',
  account_name: 'Ada Okafor',
  is_default: true,
  verified: true,
  created_at: '2026-08-01T00:00:00.000Z',
  ...over,
})

const state = (over: Partial<Parameters<typeof PayoutAccountAside>[0]['payout']> = {}) => ({
  accounts: [acct()],
  selectedId: 'acc-1',
  setSelectedId: vi.fn(),
  selected: acct(),
  reload: vi.fn(),
  ...over,
})

describe('PayoutAccountAside', () => {
  it('shimmers while the list is still loading — never "add one"', () => {
    const { container } = render(
      <PayoutAccountAside payout={state({ accounts: null, selected: null, selectedId: null })} />,
    )
    expect(container.querySelector('.animate-shimmer')).not.toBeNull()
    expect(screen.queryByText(SELL_COPY.noPayout)).toBeNull()
  })

  it('offers to add one ONLY once the list has answered empty', () => {
    render(<PayoutAccountAside payout={state({ accounts: [], selected: null, selectedId: null })} />)
    expect(screen.getByText(SELL_COPY.noPayout)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: SELL_COPY.noPayoutAction })).toHaveAttribute(
      'href',
      '/settings/payout-accounts',
    )
  })

  it('names the account, its rail and its masked number — never the full one', () => {
    const { container } = render(<PayoutAccountAside payout={state()} />)
    expect(screen.getByText('Ada Okafor')).toBeInTheDocument()
    expect(container.textContent).toContain('••••6789')
  })

  it('shows the currency each account settles in, derived from its country', () => {
    render(
      <PayoutAccountAside
        payout={state({
          accounts: [acct(), acct({ id: 'acc-2', country: 'KE', account_name: 'Wanjiru' })],
        })}
      />,
    )
    expect(screen.getByText('₦ NGN')).toBeInTheDocument()
    expect(screen.getByText('KSh KES')).toBeInTheDocument()
  })

  it('marks the selected account for assistive tech, not only with colour', () => {
    render(
      <PayoutAccountAside
        payout={state({ accounts: [acct(), acct({ id: 'acc-2', account_name: 'Second' })] })}
      />,
    )
    expect(screen.getByRole('button', { name: /Ada Okafor/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Second/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('selects on click', () => {
    const setSelectedId = vi.fn()
    render(
      <PayoutAccountAside
        payout={state({
          accounts: [acct(), acct({ id: 'acc-2', account_name: 'Second' })],
          setSelectedId,
        })}
      />,
    )
    screen.getByRole('button', { name: /Second/ }).click()
    expect(setSelectedId).toHaveBeenCalledWith('acc-2')
  })
})
