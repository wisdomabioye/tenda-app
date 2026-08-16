/**
 * The unit-tested payout visibility gates: instructions go to the
 * accepted BUYER at a live payment stage only (never in dispute — the
 * account PII must not keep circulating), the bound account goes to the
 * SELLER, and never both to one viewer.
 */
import { expect, test } from 'vitest'
import {
  shouldShowPaymentInstructions,
  shouldShowSellerPayout,
} from '@/components/exchange/PayoutCards'
import { makeExchangeDetail, makeUserRef } from '../../../test/factories/exchange'

const account = {
  kind: 'bank' as const,
  bank_code: '058',
  account_number: '0123456789',
  account_name: 'Ada Okafor',
  country: 'NG',
}

test('payment instructions: accepted/submitted buyer only, never in dispute', () => {
  const base = makeExchangeDetail({
    counterparty: makeUserRef({ id: 'buyer-1' }),
    payout_account: account,
  })
  expect(shouldShowPaymentInstructions({ ...base, status: 'accepted' }, 'buyer-1')).toBe(true)
  expect(shouldShowPaymentInstructions({ ...base, status: 'submitted' }, 'buyer-1')).toBe(true)
  expect(shouldShowPaymentInstructions({ ...base, status: 'disputed' }, 'buyer-1')).toBe(false)
  expect(shouldShowPaymentInstructions({ ...base, status: 'accepted' }, 'seller-1')).toBe(false)
  expect(shouldShowPaymentInstructions({ ...base, status: 'accepted', payout_account: null }, 'buyer-1')).toBe(false)
})

test('seller payout: creator only, through the live stages, gone once settled', () => {
  const base = makeExchangeDetail({ payout_account: account })
  for (const status of ['draft', 'open', 'accepted', 'submitted'] as const) {
    expect(shouldShowSellerPayout({ ...base, status }, 'seller-1')).toBe(true)
  }
  expect(shouldShowSellerPayout({ ...base, status: 'completed' }, 'seller-1')).toBe(false)
  expect(shouldShowSellerPayout({ ...base, status: 'open' }, 'buyer-1')).toBe(false)
})

test('never both at once for the same viewer', () => {
  const live = makeExchangeDetail({
    status: 'accepted',
    counterparty: makeUserRef({ id: 'buyer-1' }),
    payout_account: account,
  })
  for (const viewer of ['seller-1', 'buyer-1', 'stranger']) {
    const both =
      shouldShowPaymentInstructions(live, viewer) && shouldShowSellerPayout(live, viewer)
    expect(both).toBe(false)
  }
})
