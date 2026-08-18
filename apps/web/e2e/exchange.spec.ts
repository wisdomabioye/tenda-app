/**
 * The exchange surface against the stub API: the advanced-mode gate, the
 * filters as real URL state, the offer page, and the two failure states.
 *
 * The filter tests are the ones that need a browser. Their whole premise is
 * that the state survives a COLD load and a round trip through an offer — a
 * jsdom render of the same component with a mocked router cannot tell a filter
 * that lives in the URL from one that lives in a `useState`.
 */
import { test, expect } from '@playwright/test'
import { signInToHome } from './fixtures/sign-in'
import { EXISTING_EMAIL, TRADER_EMAIL } from './fixtures/auth'
import { EXCHANGE_COPY } from '../components/exchange/market/copy'
import { OFFER_DETAIL_COPY } from '../components/exchange/detail/copy'

test('the surface is LOCKED without the advanced-mode toggle, and says where to turn it on', async ({
  page,
}) => {
  await signInToHome(page, EXISTING_EMAIL)
  await page.goto('/exchange')
  await expect(page.getByText(EXCHANGE_COPY.locked.title)).toBeVisible()
  await expect(page.getByRole('link', { name: EXCHANGE_COPY.locked.action })).toHaveAttribute(
    'href',
    '/settings',
  )
  // No offers leak past the gate.
  await expect(page.getByText('Chioma Eze')).toHaveCount(0)
})

test('the order book lists open offers with their rate, chain and window', async ({ page }) => {
  await signInToHome(page, TRADER_EMAIL)
  await page.goto('/exchange')

  const book = page.getByRole('list', { name: EXCHANGE_COPY.market.label })
  await expect(book.getByRole('listitem')).toHaveCount(2)
  await expect(book.getByText('Chioma Eze')).toBeVisible()
  await expect(book.getByText('₦1,500')).toBeVisible()
  // Scoped to the book: "Solana Devnet" is also a chain-filter chip.
  await expect(book.getByText('Solana Devnet')).toBeVisible()
  await expect(page.getByText(EXCHANGE_COPY.count(2, null))).toBeVisible()
})

test('a currency chip narrows the book, lands in the URL, and survives a reload', async ({
  page,
}) => {
  await signInToHome(page, TRADER_EMAIL)
  await page.goto('/exchange')
  await page.getByRole('button', { name: 'KSh KES' }).click()

  await expect(page).toHaveURL(/\/exchange\?cur=KES/)
  const book = page.getByRole('list', { name: EXCHANGE_COPY.market.label })
  await expect(book.getByRole('listitem')).toHaveCount(1)
  await expect(page.getByText('Wanjiru Kamau')).toBeVisible()
  await expect(page.getByText(EXCHANGE_COPY.count(1, 'KES'))).toBeVisible()

  // A cold load of the same address is the same book — which is the whole
  // reason the filter is in the URL and not in component state.
  await page.reload()
  await expect(page.getByText('Wanjiru Kamau')).toBeVisible()
  await expect(page.getByText('Chioma Eze')).toHaveCount(0)
})

test('a filter set on the book survives opening an offer and coming back', async ({ page }) => {
  await signInToHome(page, TRADER_EMAIL)
  await page.goto('/exchange?cur=NGN')
  await page.getByRole('link', { name: /Chioma Eze/ }).click()

  await expect(page).toHaveURL(/\/exchange\/exch-ngn-1/)
  await page.getByRole('link', { name: OFFER_DETAIL_COPY.back }).click()

  // Opening an offer UNMOUNTS the surface; a `useState` filter would be gone.
  await expect(page).toHaveURL(/\/exchange\?cur=NGN/)
  await expect(page.getByText(EXCHANGE_COPY.count(1, 'NGN'))).toBeVisible()
})

test('the tab carries the filters with it, and shows the reader’s own trades', async ({ page }) => {
  await signInToHome(page, TRADER_EMAIL)
  await page.goto('/exchange?cur=NGN')
  await page.getByRole('link', { name: 'My trades' }).click()

  await expect(page).toHaveURL(/tab=mine/)
  await expect(page).toHaveURL(/cur=NGN/)
  const mine = page.getByRole('list', { name: EXCHANGE_COPY.mine.label })
  await expect(mine.getByRole('listitem')).toHaveCount(1)
  // The row headlines its money: an exchange escrow has no title on the wire.
  await expect(page.getByText('25 USDC')).toBeVisible()
})

test('the offer page states the rate, the terms and what the reader would pay', async ({ page }) => {
  await signInToHome(page, TRADER_EMAIL)
  await page.goto('/exchange/exch-ngn-1')

  await expect(page.getByRole('heading', { level: 1 })).toContainText('₦1,500')
  await expect(page.getByText(OFFER_DETAIL_COPY.trader)).toBeVisible()
  await expect(page.getByText(OFFER_DETAIL_COPY.terms)).toBeVisible()
  // Exact: the order-of-events list also contains the words "you pay".
  await expect(page.getByText(OFFER_DETAIL_COPY.youPay, { exact: true })).toBeVisible()
  await expect(page.getByText('₦75,000').first()).toBeVisible()

  // There is no amount field: the escrow cannot be partially taken.
  await expect(page.locator('input')).toHaveCount(0)
})

test('an offer that is gone says so and points back at the book', async ({ page }) => {
  await signInToHome(page, TRADER_EMAIL)
  await page.goto('/exchange/exch-nope')

  await expect(page.getByText(OFFER_DETAIL_COPY.unavailableTitle)).toBeVisible()
  await page.getByRole('link', { name: OFFER_DETAIL_COPY.back }).click()
  await expect(page).toHaveURL(/\/exchange$/)
})
