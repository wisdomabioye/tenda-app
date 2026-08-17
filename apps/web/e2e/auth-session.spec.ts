import { expect, test, type Page } from '@playwright/test'
import { E2E_OTP_CODE, EXISTING_EMAIL } from './fixtures/auth'

/**
 * The workspace rail's profile link, by its accessible name: the rail's own
 * label plus the signed-in user's name (RailLink builds it that way so the
 * destination and the identity are announced together).
 *
 * Named in full rather than matched loosely on "Ada Okafor" — the seeded
 * poster has the same name, so every gig card on /home carries it too and a
 * substring match is ambiguous.
 */
const PROFILE_LINK = 'Your profile, Ada Okafor'

/**
 * Stage-2 DoD flows against the stub API: sign-up end-to-end, sign-in for an
 * existing account, wrong-OTP handling, session persistence, route
 * protection, logout, and cross-tab logout.
 */

async function signInWith(page: Page, email: string) {
  await page.goto('/signin')
  await page.getByRole('link', { name: 'Continue with email' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Send code' }).click()
  await page.getByLabel('Verification code').fill(E2E_OTP_CODE)
}

/**
 * Sign out lives on /profile — the workspace rail carries no destructive
 * control, so the button is reached the way a user reaches it rather than
 * assumed to be in the chrome.
 */
async function signOut(page: Page) {
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Sign out' }).click()
}

test('sign-up: email → code → profile setup → home shell', async ({ page }) => {
  await signInWith(page, 'fresh@tenda.test')
  // Fresh account: empty names route to onboarding.
  await expect(page).toHaveURL(/\/onboarding\/profile/)
  await page.getByLabel('First name').fill('Chidi')
  await page.getByLabel('Last name').fill('Eze')
  await page.getByRole('button', { name: 'Finish' }).click()
  await expect(page).toHaveURL(/\/home/)
  await expect(page.getByRole('link', { name: 'My Gigs' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Your profile, Chidi Eze' })).toBeVisible()
})

test('sign-in: an existing complete profile lands straight on /home', async ({ page }) => {
  await signInWith(page, EXISTING_EMAIL)
  await expect(page).toHaveURL(/\/home/)
  await expect(page.getByRole('link', { name: PROFILE_LINK })).toBeVisible()
})

test('a wrong code surfaces the server message and clears the field', async ({ page }) => {
  await page.goto('/signin/email')
  await page.getByLabel('Email').fill(EXISTING_EMAIL)
  await page.getByRole('button', { name: 'Send code' }).click()
  await page.getByLabel('Verification code').fill('000000')
  await expect(page.getByText('Invalid or expired code')).toBeVisible()
  await expect(page.getByLabel('Verification code')).toHaveValue('')
  await expect(page).toHaveURL(/\/signin\/verify/)
})

test('deep-linking the verify step without a pending challenge restarts at email', async ({ page }) => {
  await page.goto('/signin/verify')
  await expect(page).toHaveURL(/\/signin\/email/)
})

test('the session survives a reload', async ({ page }) => {
  await signInWith(page, EXISTING_EMAIL)
  await expect(page).toHaveURL(/\/home/)
  await page.reload()
  await expect(page.getByRole('link', { name: PROFILE_LINK })).toBeVisible()
})

test('an authed route redirects an anonymous visitor to /signin', async ({ page }) => {
  await page.goto('/home')
  await expect(page).toHaveURL(/\/signin/)
})

test('logout clears the bearer and locks the app again', async ({ page }) => {
  await signInWith(page, EXISTING_EMAIL)
  await expect(page).toHaveURL(/\/home/)
  await signOut(page)
  await expect(page).toHaveURL(/\/gigs/)
  const stored = await page.evaluate(() => localStorage.getItem('jwt_token'))
  expect(stored).toBeNull()
  await page.goto('/home')
  await expect(page).toHaveURL(/\/signin/)
})

test('logging out in one tab signs out the other', async ({ page, context }) => {
  await signInWith(page, EXISTING_EMAIL)
  await expect(page).toHaveURL(/\/home/)

  const other = await context.newPage()
  await other.goto('/home')
  await expect(other.getByRole('link', { name: PROFILE_LINK })).toBeVisible()

  await signOut(page)
  await expect(page).toHaveURL(/\/gigs/)
  // The storage event lands in the other tab and its gate locks.
  await expect(other).toHaveURL(/\/signin/, { timeout: 10_000 })
})

test('the public header flips to "Home" for a signed-in visitor', async ({ page }) => {
  await signInWith(page, EXISTING_EMAIL)
  await expect(page).toHaveURL(/\/home/)
  await page.goto('/gigs')
  await expect(page.getByRole('link', { name: 'Home' })).toBeVisible()
})
