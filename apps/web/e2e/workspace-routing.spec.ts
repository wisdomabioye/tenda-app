import { expect, test } from '@playwright/test'
import { signInToHome } from './fixtures/sign-in'

test('root is public while private home requires authentication', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Work that pays/ })).toBeVisible()
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

test('the create control offers explicit gig and offer composers', async ({ page }) => {
  await signInToHome(page)
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByRole('menuitem', { name: 'Create gig' })).toHaveAttribute('href', '/gigs/new')
  await expect(page.getByRole('menuitem', { name: 'Create offer' })).toHaveAttribute('href', '/offers/new')
  for (const route of ['/create', '/gigs/new', '/offers/new']) {
    await page.goto(route)
    await expect(page.getByRole('navigation', { name: 'Workspace' })).toBeVisible()
  }
})

test('unpublished legacy routes do not exist', async ({ request }) => {
  for (const route of ['/gigs', '/post', '/exchange/new']) {
    expect((await request.get(route)).status(), route).toBe(404)
  }
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
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBe(0)

  await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await page.getByRole('button', { name: 'Create' }).click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  const box = await menu.boundingBox()
  expect(box).not.toBeNull()
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390)
})
