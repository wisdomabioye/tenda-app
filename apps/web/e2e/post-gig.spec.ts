import { expect, test, type Page } from '@playwright/test'
import { E2E_OTP_CODE, EXISTING_EMAIL } from './fixtures/auth'

/**
 * S4.1 creation wizard against the stub API: step gating, the composed
 * review, the pre-sign confirm gate, and the draft-survival contract — the
 * e2e build has NO wallet runtime, so signing fails with the typed
 * no-wallet error AFTER the draft + details are committed, which must land
 * the user on the draft's page with the "draft saved" toast (the same path
 * a declined signature takes).
 */

async function signIn(page: Page) {
  await page.goto('/signin/email')
  await page.getByLabel('Email').fill(EXISTING_EMAIL)
  await page.getByRole('button', { name: 'Send code' }).click()
  await page.getByLabel('Verification code').fill(E2E_OTP_CODE)
  await expect(page).toHaveURL(/\/home/)
}

async function fillDetailsStep(page: Page) {
  await page.getByRole('radio', { name: 'Delivery' }).click()
  await page.getByLabel('Title').fill('Deliver a package to Victoria Island')
  await page.getByLabel('Description').fill('Pick up from Ikeja, drop off same day.')
  // Remote skips the location pair.
  await page.getByRole('switch', { name: 'Remote' }).click()
}

test('the wizard gates each step on the first actionable requirement', async ({ page }) => {
  await signIn(page)
  await page.getByRole('link', { name: 'Post a Gig' }).click()
  await expect(page).toHaveURL(/\/post/)

  const continueBtn = page.getByRole('button', { name: 'Continue' })
  await expect(continueBtn).toBeDisabled()
  await expect(page.getByText('Pick a category to continue')).toBeVisible()

  await fillDetailsStep(page)
  await continueBtn.click()

  // Payment step: no budget yet.
  await expect(page.getByText('Set payment and timing')).toBeVisible()
  await expect(continueBtn).toBeDisabled()
  await expect(page.getByText('Set a budget to continue')).toBeVisible()
  await page.getByLabel('Budget in USDC').fill('25')
  await expect(page.getByText('Worker receives')).toBeVisible() // fee honesty card
  await continueBtn.click()

  // Delivery step: review card states the composed facts.
  await expect(page.getByText('Define delivery')).toBeVisible()
  await expect(page.getByText('Deliver a package to Victoria Island')).toBeVisible()
  await expect(page.getByText('25 USDC')).toBeVisible()
})

test('posting walks the full chain and survives a missing wallet as a saved draft', async ({ page }) => {
  await signIn(page)
  await page.goto('/post')
  await fillDetailsStep(page)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Budget in USDC').fill('25')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Post Gig' }).click()

  // The pre-sign confirm gate names the locked amount and the wallet.
  const dialog = page.getByRole('alertdialog', { name: 'Fund this gig?' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('locks 25 USDC in escrow')
  await expect(dialog).toContainText('Your wallet will open next')
  await dialog.getByRole('button', { name: 'Fund Gig' }).click()

  // Draft + details committed server-side; signing dead-ends (no wallet
  // runtime in this build) → the draft survives and the screen lands on it,
  // where the party rescue serves it through the anonymous 404.
  await expect(page.getByText(/Wallet connect is not configured/)).toBeVisible()
  await expect(page).toHaveURL(/\/gig\/new-gig-1/)
  await expect(page.getByText('Draft — not published yet')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit & repost' })).toBeVisible()
})

test('cancelling the confirm gate leaves the composer untouched', async ({ page }) => {
  await signIn(page)
  await page.goto('/post')
  await fillDetailsStep(page)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Budget in USDC').fill('25')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Post Gig' }).click()

  await page.getByRole('alertdialog', { name: 'Fund this gig?' }).getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('alertdialog')).toBeHidden()
  // Still on the review step with the composed values intact.
  await expect(page).toHaveURL(/\/post/)
  await expect(page.getByText('Deliver a package to Victoria Island')).toBeVisible()
})
