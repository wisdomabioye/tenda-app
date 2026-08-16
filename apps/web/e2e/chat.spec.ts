/**
 * S5.2 chat flows against the stub API: inbox badge + sections, thread
 * rendering (day headers, escrow-context pill), sending (optimistic →
 * server-confirmed), read-marking clearing the badge, and the
 * close-conversation flow. The socket never connects in e2e (the stub has
 * no /v1/ws), so everything here rides the FALLBACK polling path — which
 * doubles as proof the app works with the socket down.
 */
import { test, expect, type Page } from '@playwright/test'
import { E2E_OTP_CODE, EXISTING_EMAIL } from './fixtures/auth'

// SERIAL, deliberately: these three tests share ONE mutable stub chat world
// (read-marking, a growing message log, close). Under fullyParallel they
// would race each other across workers and flake on ordering.
test.describe.configure({ mode: 'serial' })

// Every test (and every CI RETRY of one) starts from the seeded world —
// without this, a retry inherits the state its first attempt mutated.
const STUB_URL = `http://127.0.0.1:${process.env.STUB_API_PORT ?? 3210}`
test.beforeEach(async ({ request }) => {
  await request.post(`${STUB_URL}/__e2e/reset-chat`)
})

async function signIn(page: Page) {
  await page.goto('/signin/email')
  await page.getByLabel('Email').fill(EXISTING_EMAIL)
  await page.getByRole('button', { name: 'Send code' }).click()
  await page.getByLabel('Verification code').fill(E2E_OTP_CODE)
  await expect(page).toHaveURL(/\/home/)
}

test('inbox: unread badge in the nav, sections, and read-marking on open', async ({ page }) => {
  await signIn(page)
  // Badge reflects the seeded 2-unread conversation.
  await expect(page.getByLabel('2 unread messages')).toHaveText('2')

  await page.getByRole('link', { name: /Messages/ }).click()
  await expect(page.getByText('Unread', { exact: true })).toBeVisible()
  await expect(page.getByText('Are you still available tomorrow?')).toBeVisible()

  // Opening the thread marks it read; back at the inbox it files under Earlier.
  await page.getByRole('link', { name: 'Open chat with Bola Ade' }).click()
  await expect(page.getByText('Hi! I saw your gig posting.')).toBeVisible()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByText('Earlier')).toBeVisible()
  await expect(page.getByText('Unread', { exact: true })).toHaveCount(0)
})

test('thread: context pill links the gig, sending confirms the optimistic bubble', async ({ page }) => {
  await signIn(page)
  await page.goto(`/chat/user-bola-1`)

  // The escrow-context divider from msg-1 links to the public gig page.
  await expect(
    page.getByRole('link', { name: 'Open gig: Deliver documents downtown' }),
  ).toBeVisible()

  // Viewport lock: the composer is on-screen with NO document scroll — the
  // message list is the only scroller (the -my-5/h-14 arithmetic).
  await expect(page.getByPlaceholder('Message…')).toBeInViewport()
  const hasDocumentScroll = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight,
  )
  expect(hasDocumentScroll).toBe(false)

  await page.getByPlaceholder('Message…').fill('Yes — see you at noon')
  await page.keyboard.press('Enter')
  // The bubble appears (optimistic) and STAYS after the server swap.
  await expect(page.getByText('Yes — see you at noon')).toBeVisible()
  await expect(page.getByText('Sending…')).toHaveCount(0)
  await expect(page.getByPlaceholder('Message…')).toHaveValue('')
})

test('close conversation: confirm dialog → thread leaves the inbox', async ({ page }) => {
  await signIn(page)
  await page.goto(`/chat/user-bola-1`)
  await expect(page.getByText('Hi! I saw your gig posting.')).toBeVisible()

  await page.getByRole('button', { name: 'More options' }).click()
  await page.getByRole('button', { name: /Close conversation/ }).click()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page).toHaveURL(/\/messages/)
  // The closed thread has left the inbox (server lists active only).
  await expect(page.getByText('No conversations yet')).toBeVisible()
})
