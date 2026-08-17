import { expect, test, type Page } from '@playwright/test'
import { E2E_OTP_CODE, EXISTING_EMAIL } from './fixtures/auth'
import { AUTH_COPY } from '../components/auth/copy'
import { signInAs, signInFromChooser } from './fixtures/sign-in'

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
  await signInFromChooser(page, 'fresh@tenda.test')
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
  await signInFromChooser(page, EXISTING_EMAIL)
  await expect(page).toHaveURL(/\/home/)
  await expect(page.getByRole('link', { name: PROFILE_LINK })).toBeVisible()
})

test('a wrong code surfaces the server message and clears the field', async ({ page }) => {
  await signInAs(page, EXISTING_EMAIL, '000000')
  await expect(page.getByText('Invalid or expired code')).toBeVisible()
  await expect(page.getByLabel('Verification code')).toHaveValue('')
  await expect(page).toHaveURL(/\/signin\/verify/)
})

test('deep-linking the verify step without a pending challenge restarts at email', async ({ page }) => {
  await page.goto('/signin/verify')
  await expect(page).toHaveURL(/\/signin\/email/)
})

test('the session survives a reload', async ({ page }) => {
  await signInFromChooser(page, EXISTING_EMAIL)
  await expect(page).toHaveURL(/\/home/)
  await page.reload()
  await expect(page.getByRole('link', { name: PROFILE_LINK })).toBeVisible()
})

test('an authed route redirects an anonymous visitor to /signin', async ({ page }) => {
  await page.goto('/home')
  await expect(page).toHaveURL(/\/signin/)
})

test('logout clears the bearer and locks the app again', async ({ page }) => {
  await signInFromChooser(page, EXISTING_EMAIL)
  await expect(page).toHaveURL(/\/home/)
  await signOut(page)
  await expect(page).toHaveURL(/\/gigs/)
  const stored = await page.evaluate(() => localStorage.getItem('jwt_token'))
  expect(stored).toBeNull()
  await page.goto('/home')
  await expect(page).toHaveURL(/\/signin/)
})

test('logging out in one tab signs out the other', async ({ page, context }) => {
  await signInFromChooser(page, EXISTING_EMAIL)
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
  await signInFromChooser(page, EXISTING_EMAIL)
  await expect(page).toHaveURL(/\/home/)
  await page.goto('/gigs')
  await expect(page.getByRole('link', { name: 'Home' })).toBeVisible()
})

test.describe('the focused shell (#14)', () => {
  test('the chooser says what each method DOES, and works with no bundle', async ({ page }) => {
    await page.goto('/signin')
    // Email creates accounts; a wallet only signs an existing one in. A
    // chooser that hides that sends a new user down the path that cannot end.
    await expect(page.getByRole('link', { name: /^Continue with email/ })).toContainText(
      AUTH_COPY.chooser.email.hint,
    )
    await expect(page.getByRole('link', { name: /^Continue with a wallet/ })).toContainText(
      AUTH_COPY.chooser.wallet.hint,
    )
    // The public feed is a real third option, not a consolation prize.
    await expect(page.getByRole('link', { name: AUTH_COPY.chooser.browse })).toHaveAttribute(
      'href',
      '/gigs',
    )
  })

  test('every step past the chooser offers the way back', async ({ page }) => {
    await page.goto('/signin/email')
    await expect(page.getByRole('link', { name: AUTH_COPY.email.back })).toHaveAttribute(
      'href',
      '/signin',
    )
    await page.goto('/signin/wallet')
    await expect(page.getByRole('link', { name: AUTH_COPY.wallet.back })).toHaveAttribute(
      'href',
      '/signin',
    )
  })

  test('the verify step counts down the window the SERVER set', async ({ page }) => {
    // The stub answers `expires_in: 600`, so the page shows ten minutes rather
    // than a constant typed into the app.
    await page.goto('/signin/email')
    await page.getByLabel(AUTH_COPY.email.label).fill(EXISTING_EMAIL)
    await page.getByRole('button', { name: AUTH_COPY.email.cta }).click()
    await expect(page.getByText(/Expires in \d+:\d\d/)).toBeVisible()
    // …and it names where the code went, rather than saying "your email".
    await expect(page.getByText(EXISTING_EMAIL)).toBeVisible()
  })

  test('a rejected code can be retyped without touching the mouse', async ({ page }) => {
    // The field is disabled while the request is in flight, and a browser blurs
    // a disabled element — so focus fell to <body> and the reader had to hunt
    // for the box in the loop they are most likely to repeat. Only a real
    // browser shows this; jsdom does not blur on disable.
    await signInAs(page, EXISTING_EMAIL, '000000')
    // By text, not by role: Next ships its own always-present
    // `role="alert"` route announcer, so a bare role query is ambiguous here.
    await expect(page.getByText('Invalid or expired code')).toBeVisible()
    await expect(page.getByLabel('Verification code')).toBeFocused()
    // No click anywhere: type straight on and the sign-in completes.
    await page.keyboard.type(E2E_OTP_CODE)
    await expect(page).toHaveURL(/\/home/)
  })

  test('a double click on the resend sends ONE code, not two', async ({ page }) => {
    // The 60s cooldown only starts when the challenge RESOLVES, so it cannot
    // guard the request in flight — two clicks meant two emails or two SMS the
    // platform pays for, and the first to arrive was already dead.
    //
    // `page.clock` rather than a 60-second wait: both countdowns are DERIVED
    // from Date.now(), which is exactly what makes them fast-forwardable.
    await page.clock.install()
    await page.goto('/signin/email')
    await page.getByLabel(AUTH_COPY.email.label).fill(EXISTING_EMAIL)
    await page.getByRole('button', { name: AUTH_COPY.email.cta }).click()
    await expect(page.getByText(/Expires in \d+:\d\d/)).toBeVisible()

    const challenges: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/v1/auth/challenge')) challenges.push(r.url())
    })

    await page.clock.fastForward('01:05')
    const resend = page.getByRole('button', { name: AUTH_COPY.verify.resend })
    await expect(resend).toBeEnabled()
    await resend.dblclick()

    // The cooldown is running again, so the resend did happen — once.
    await expect(
      page.getByRole('button', { name: AUTH_COPY.verify.resendIn(60) }),
    ).toBeDisabled()
    expect(challenges).toHaveLength(1)
  })

  test('a long address does not drag the card off a 320px screen', async ({ page }) => {
    // The panel gave `break-words` to the heading, but the address is echoed
    // into the LEDE — measured at 595px of layout on a 320px viewport before
    // this. See CLAUDE.md, "text a poster wrote".
    const long = 'oluwaseunadebayoakinwandeoyelaranolusegun@mail.subdomain.example.co.uk'
    await page.setViewportSize({ width: 320, height: 720 })
    await page.goto('/signin/email')
    await page.getByLabel(AUTH_COPY.email.label).fill(long)
    await page.getByRole('button', { name: AUTH_COPY.email.cta }).click()
    await expect(page.getByText(long)).toBeVisible()

    const doc = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }))
    expect(doc.scroll).toBe(doc.client)
  })

  test('the shell keeps a way out of a flow you did not mean to start', async ({ page }) => {
    await page.goto('/signin/email')
    await page.getByRole('link', { name: /Tenda/ }).click()
    await expect(page).toHaveURL(/\/gigs/)
  })
})
