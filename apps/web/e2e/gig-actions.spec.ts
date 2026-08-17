import { signInToHome } from './fixtures/sign-in'
import { expect, test } from '@playwright/test'
import { deliveryGig, photoGig } from './fixtures/gigs'

/**
 * S4.4/S4.6 detail surface against the stub API: the bearer refetch swaps
 * the sign-in CTA for the party surface, wallet-opening transitions ride the
 * confirm gate, the party rescue serves drafts through the anonymous 404,
 * and the takedown banner reaches the party while strangers keep the 404.
 */


test('anonymous readers see the sign-in CTA; the poster sees their actions instead', async ({ page }) => {
  await page.goto('/gig/gig-delivery-1')
  await expect(page.getByRole('link', { name: /Sign in to/ })).toBeVisible()

  await signInToHome(page)
  await page.goto('/gig/gig-delivery-1')
  // The stub casts the signed-in user as the creator of an open gig.
  await expect(page.getByRole('button', { name: 'Cancel Gig' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Sign in to/ })).toBeHidden()
  // The party panel shows the escrow facts the anonymous page never carries.
  await expect(page.getByText('Your escrow')).toBeVisible()
})

test('a wallet-opening transition rides the confirm gate; cancelling backs out clean', async ({ page }) => {
  await signInToHome(page)
  await page.goto('/gig/gig-delivery-1')
  await page.getByRole('button', { name: 'Cancel Gig' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Cancel this gig?' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('refunded to your wallet')
  await expect(dialog).toContainText('Your wallet will open next')
  await dialog.getByRole('button', { name: 'Cancel' }).first().click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: 'Cancel Gig' })).toBeVisible()
})

test('confirming without a wallet runtime surfaces the typed error, not a hang', async ({ page }) => {
  await signInToHome(page)
  await page.goto('/gig/gig-delivery-1')
  await page.getByRole('button', { name: 'Cancel Gig' }).click()
  await page
    .getByRole('alertdialog', { name: 'Cancel this gig?' })
    .getByRole('button', { name: 'Cancel Gig' })
    .click()
  await expect(page.getByText(/Wallet connect is not configured/)).toBeVisible()
})

test("the party rescue serves a DRAFT through the anonymous 404", async ({ page }) => {
  // Anonymous: the draft is a hard 404 (crawler contract).
  const anon = await page.request.get('/gig/new-gig-1')
  expect(anon.status()).toBe(404)

  await signInToHome(page)
  await page.goto('/gig/new-gig-1')
  await expect(page.getByText('Draft — not published yet')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit & repost' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Delete Draft' })).toBeVisible()
})

test('a taken-down gig shows its party the banner and keeps the way out', async ({ page }) => {
  await signInToHome(page)
  await page.goto('/gig/hidden-party-gig')
  await expect(page.getByText('Removed by moderation')).toBeVisible()
  // The way OUT stays; the ways IN are gone.
  await expect(page.getByRole('button', { name: 'Cancel Gig' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Accept Gig' })).toBeHidden()
})

test('a signed-in stranger to a truly missing gig keeps the not-available copy', async ({ page }) => {
  await signInToHome(page)
  await page.goto('/gig/no-such-gig')
  // The 404 panel's own heading (#13 gave it the comp's shape); the rescue
  // island has already run and found nothing, which is what this asserts.
  await expect(page.getByRole('heading', { name: 'This gig is not available' })).toBeVisible()
})

/**
 * The stub scopes `?mine=` to one gig per bucket, so the two tabs are provably
 * different lists rather than the same feed twice.
 */
const POSTED_GIG_TITLE = deliveryGig.title
const WORKING_GIG_TITLE = photoGig.title

test.describe('My Gigs as a list column (#17)', () => {
  test('the tab and the chain filter survive opening a gig', async ({ page }) => {
    // The @list slot remounts on every row opened, so both live in the URL —
    // and the row hrefs carry them, or the gig just clicked leaves the list.
    await signInToHome(page)
    await page.goto('/my-gigs')
    await expect(page.getByRole('link', { name: /^Posted/ })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await page.getByRole('link', { name: /^Working/ }).click()
    await expect(page).toHaveURL(/mine=working/)

    const row = page.getByRole('link', { name: new RegExp(WORKING_GIG_TITLE) })
    await expect(row).toBeVisible()
    await row.click()

    await expect(page).toHaveURL(/\/my-gigs\/[^/?]+\?mine=working/)
    await expect(page.locator('[data-list]')).toBeVisible()
    await expect(page.getByRole('link', { name: /^Working/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.getByRole('link', { name: new RegExp(WORKING_GIG_TITLE) })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  test('the authed dossier renders the escrow; a signed-out visitor is gated', async ({
    page,
    browser,
  }) => {
    await signInToHome(page)
    await page.goto('/my-gigs')
    await page.getByRole('link', { name: new RegExp(POSTED_GIG_TITLE) }).click()
    await expect(page.getByRole('heading', { level: 1, name: POSTED_GIG_TITLE })).toBeVisible()

    // The app address is authed-only: `AuthGate` sends a signed-out visitor to
    // /signin before this page renders, which is what every other (app) route
    // does. The address to SHARE is the public /gig/<id>.
    const url = page.url()
    const anon = await browser.newContext()
    const anonPage = await anon.newPage()
    await anonPage.goto(url)
    await expect(anonPage).toHaveURL(/\/signin/)
    await anon.close()
  })
})
