/**
 * S5.3 notification centre against the stub API: bell badge on sign-in,
 * announcements pinned over the personal feed, mark-all clearing the
 * badge, and a routable row deep-linking to its gig. Serial + per-test
 * reset — the world is mutable and CI retries must start seeded.
 */
import { test, expect } from '@playwright/test'
import { signInToHome } from './fixtures/sign-in'

test.describe.configure({ mode: 'serial' })

const STUB_URL = `http://127.0.0.1:${process.env.STUB_API_PORT ?? 3210}`
test.beforeEach(async ({ request }) => {
  await request.post(`${STUB_URL}/__e2e/reset-notifications`)
})


test('bell badge counts unread; the centre pins the announcement over the feed', async ({ page }) => {
  await signInToHome(page)
  const bell = page.getByRole('link', { name: 'Notifications, 1 unread' })
  await expect(bell).toHaveText('1')

  await bell.click()
  await expect(page).toHaveURL(/\/notifications/)
  await expect(page.getByText('Fee update')).toBeVisible()
  await expect(page.getByRole('button', { name: /Gig accepted, unread/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Welcome to Tenda' })).toBeVisible()
})

test('mark all read clears the rows and the bell badge', async ({ page }) => {
  await signInToHome(page)
  await page.goto('/notifications')
  await page.getByRole('button', { name: 'Mark all read' }).click()
  await expect(page.getByRole('button', { name: 'Gig accepted' })).toBeVisible() // aria drops ', unread'
  await expect(page.getByRole('link', { name: 'Notifications' })).toBeVisible() // badge gone
  await expect(page.getByRole('button', { name: 'Mark all read' })).toHaveCount(0)
})

test('a routable notice marks read and lands on its gig', async ({ page }) => {
  await signInToHome(page)
  await page.goto('/notifications')
  await page.getByRole('button', { name: /Gig accepted, unread/ }).click()
  await expect(page).toHaveURL(/\/gig\/gig-delivery-1/)
  await expect(page.getByText('Deliver a parcel across Yaba').first()).toBeVisible()
})
