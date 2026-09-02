import { expect, test } from '@playwright/test'
import { APP_INFO } from '@tenda/shared'
import { OFFER_DETAIL_COPY } from '../components/exchange/detail/copy'
import { signInToHome } from './fixtures/sign-in'

test('root is public while private home requires authentication', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: APP_INFO.tagline })).toBeVisible()
  await page.goto('/home')
  await expect(page).toHaveURL(/\/signin$/)
})

test('signed-in visitors cannot return to guest-only auth surfaces', async ({ page }) => {
  await signInToHome(page)
  for (const route of ['/welcome', '/signin', '/signin/email', '/signin/wallet']) {
    await page.goto(route)
    await expect(page).toHaveURL(/\/home$/)
  }
})

test('the create control offers mobile\'s FAB pairing — gig, and sell/cash-out', async ({
  page,
}) => {
  await signInToHome(page)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByRole('menuitem', { name: 'Create gig' })).toHaveAttribute(
    'href',
    '/gigs/new',
  )
  // Offer creation is a MODE of selling (spec-correction #50) — the menu
  // points at the ONE sell surface, never a second composer.
  await expect(page.getByRole('menuitem', { name: 'Sell / Cash out' })).toHaveAttribute(
    'href',
    '/wallet/buy-sell',
  )
  for (const route of ['/create', '/gigs/new']) {
    await page.goto(route)
    await expect(page.getByRole('navigation', { name: 'Workspace' })).toBeVisible()
  }
})

test('unpublished legacy routes do not exist', async ({ request }) => {
  // /offers/new joined this list in #50: the second offer composer is retired.
  for (const route of ['/gigs', '/post', '/offers/new']) {
    expect((await request.get(route)).status(), route).toBe(404)
  }
})

test('/exchange/new is an offer id like any other — the retired stub is gone', async ({
  page,
}) => {
  // With the (public) stub deleted, the segment falls through to the authed
  // detail route, which answers a non-existent id with its unavailable state.
  await signInToHome(page)
  await page.goto('/exchange/new')
  await expect(page.getByText(OFFER_DETAIL_COPY.unavailableTitle)).toBeVisible()
})

test('home replaces a retained list with open gigs', async ({ page }) => {
  await signInToHome(page)
  await page.getByRole('link', { name: 'My Gigs' }).click()
  await expect(page.locator('[data-list]')).toBeVisible()
  await page.locator('nav[aria-label="Workspace"] a[aria-label="Home"]').click()
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.locator('[data-list]')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Open gigs' })).toBeVisible()
})

test('opening a home gig keeps the list and shows its detail', async ({ page }) => {
  await signInToHome(page)
  await page.locator('[data-list] a').first().click()
  await expect(page).toHaveURL(/\/home\/gigs\//)
  await expect(page.locator('[data-list]')).toBeVisible()
  await expect(page.locator('[data-detail] article')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel Gig' })).toHaveCount(1)
})

test('desktop sidebar expands by default and can be collapsed', async ({ page }) => {
  await signInToHome(page)
  await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible()
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
})

test('workspace sign-out clears the session and locks private routes', async ({ page }) => {
  await signInToHome(page)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/home')
  await expect(page).toHaveURL(/\/signin$/)
})

test('phone sidebar is collapsed by default without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signInToHome(page)
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBe(0)

  await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await page.getByRole('button', { name: 'Create' }).click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  const box = await menu.boundingBox()
  expect(box).not.toBeNull()
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390)
})

/**
 * The @list slot must not carry one surface's list into a surface that has
 * none. Next keeps an unmatched slot's last active subpage across a SOFT
 * navigation (`default.tsx` only answers a hard load), so clicking Wallet from
 * Home used to leave Home's gig list mounted — and at ≤900px the shell hands
 * the screen to a list whenever nothing is selected, so the reader got a stale
 * gig list and no Wallet at all.
 *
 * What closes it is `AppWorkspace`, which passes the slot on only for a surface
 * `SURFACE_LIST_HOME` names. NOT a `@list/[...rest]` catch-all: that answers
 * every surface and also makes every URL matchable inside (app) — measured,
 * `/gigs` began answering 200 instead of 404, caught by "unpublished legacy
 * routes do not exist" in this same file.
 *
 * Driven by CLICKING the rail, never `goto`: a hard load was always correct,
 * so a navigation-free version of this test would pass against the bug.
 */
// Located by href, not by accessible name: the rail appends state to several
// of those names ("Notifications, 2 unread", "Your profile, <display name>"),
// so a name-based locator here would be testing the badge.
const LISTLESS = ['/wallet', '/exchange', '/settings', '/profile']
const WITH_LIST = ['/my-gigs', '/messages', '/notifications', '/disputes', '/home']

for (const width of [390, 1280]) {
  test(`a surface with no list column shows no list after a soft navigation (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await signInToHome(page)
    const rail = page.getByRole('navigation', { name: 'Workspace' })

    for (const href of LISTLESS) {
      await page.goto('/home')
      await expect(page.locator('[data-list]')).toBeVisible()
      await rail.locator(`a[href="${href}"]`).first().click()
      await expect(page).toHaveURL(new RegExp(`${href}$`))
      await expect(page.locator('[data-list]')).toHaveCount(0)
      // The half that made it a blank page rather than a wrong column.
      await expect(page.locator('[data-detail]').first()).toBeVisible()
    }
  })
}

test('surfaces that DO have a list column still get one after a soft navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await signInToHome(page)
  const rail = page.getByRole('navigation', { name: 'Workspace' })

  // The gate must not swallow a real list. Reached from a LISTLESS surface
  // each time, so every hop is a genuine surface change.
  for (const href of WITH_LIST) {
    await page.goto('/wallet')
    await expect(page.locator('[data-list]')).toHaveCount(0)
    await rail.locator(`a[href="${href}"]`).first().click()
    await expect(page).toHaveURL(new RegExp(`${href}$`))
    await expect(page.locator('[data-list]')).toBeVisible()
  }
})
