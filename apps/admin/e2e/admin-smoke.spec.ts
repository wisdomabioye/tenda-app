import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

const WALLET_RUNTIME = /reown|walletconnect|wagmi|solana/i
const REACT_RUNTIME_ERROR = /hydration|server rendered html didn't match|encountered a script tag/i

function captureRuntimeFailures(page: Page) {
  const failures: string[] = []

  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`))
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error' || REACT_RUNTIME_ERROR.test(message.text())) {
      failures.push(`console.${message.type()}: ${message.text()}`)
    }
  })

  return failures
}

test('login hydrates cleanly, stays interactive, and excludes wallet runtime', async ({ page }) => {
  const failures = captureRuntimeFailures(page)
  const walletRequests: string[] = []
  page.on('request', (request) => {
    if (WALLET_RUNTIME.test(request.url())) walletRequests.push(request.url())
  })

  await page.route('**/v1/auth/admin/send-email-otp', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
  await page.goto('/login')

  await expect(page.getByText('Tenda Admin', { exact: true })).toBeVisible()
  await page.getByLabel('Email').fill('admin@example.test')
  await page.getByRole('button', { name: 'Send code' }).click()
  await expect(page.getByLabel('One-time code')).toBeVisible()

  expect(walletRequests).toEqual([])
  expect(failures).toEqual([])
})

test('saved dark theme survives a real browser reload without hydration errors', async ({ page }) => {
  const failures = captureRuntimeFailures(page)

  await page.goto('/login')
  await page.evaluate(() => localStorage.setItem('theme', 'dark'))
  await page.reload()

  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByText('Tenda Admin', { exact: true })).toBeVisible()
  expect(failures).toEqual([])
})

test('an unauthenticated root visit goes straight to login without loading disputes', async ({ page }) => {
  const failures = captureRuntimeFailures(page)
  const documentPaths: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'document') documentPaths.push(new URL(request.url()).pathname)
  })

  await page.goto('/')

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('Tenda Admin', { exact: true })).toBeVisible()
  expect(documentPaths).not.toContain('/disputes')
  expect(failures).toEqual([])
})
