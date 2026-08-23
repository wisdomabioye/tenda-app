/**
 * Tier 1 public — the FEED at /, served without JavaScript: server-rendered
 * rows, filters as links, sort and cursor handling, and the canonical each view
 * declares. The detail page and the SEO surfaces are in public-detail.spec.ts.
 */
import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'
import { CATEGORY_LABELS } from '@tenda/shared'
import { FEED_COPY } from '../components/gig/feed/copy'
import {
  deliveryGig,
  E2E_FAIL_QUERY,
  deliveryGigDetail,
  photoGig,
  unbreakableGigDetail,
} from './fixtures/gigs'

function captureRuntimeFailures(page: Page) {
  const failures: string[] = []
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`))
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') failures.push(`console.error: ${message.text()}`)
  })
  return failures
}


test.describe('feed — /', () => {
  test('is server-rendered: raw HTML carries titles and amounts, no JS needed', async ({ request }) => {
    const response = await request.get('/')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain(deliveryGig.title)
    expect(html).toContain(photoGig.title)
    expect(html).toContain(`/gig/${deliveryGig.escrow_id}`)
    // 25000000 raw USDC (6 decimals) must never reach the page as base units.
    // The DISPLAY figure is asserted in the no-JavaScript test below, against
    // real rendered text: the card sets the value and its ticker at different
    // sizes, so they are separate elements, and searching this string for
    // "25 USDC" would only ever match the RSC flight payload.
    expect(html).not.toContain('25000000')
    expect(html).not.toContain(deliveryGig.description!)
  })

  test.describe('with JavaScript disabled', () => {
    test.use({ javaScriptEnabled: false })

    test('the feed renders, reads correctly, and every filter still works', async ({ page }) => {
      await page.goto('/')
      const card = page.getByRole('link', { name: new RegExp(deliveryGig.title) })
      // Rendered text, not markup: this is what a reader actually sees, and
      // it proves the split figure still reads as one amount.
      await expect(card).toContainText('25 USDC')
      await expect(card).toContainText('Lagos, Nigeria')

      // A filter that only works once the bundle runs is a filter this page
      // does not have — the feed is the surface an anonymous visitor reaches
      // first, often on a slow connection.
      // The label comes from the shared vocabulary: `photo` reads "Creative",
      // and a hardcoded "Photo" here would test a string this product does
      // not use. Scoped to the rail's category GROUP to separate it from the
      // card carrying the same word — `exact` used to do that job, but the
      // rail link now also states its count ("Creative 1 gig"), and pinning
      // the exact name here would make this test fail whenever a fixture
      // changes how many gigs are in the category.
      await page
        .getByRole('group', { name: FEED_COPY.rail.category })
        .getByRole('link', { name: CATEGORY_LABELS.photo })
        .click()
      await expect(page).toHaveURL(/category=photo/)
      await expect(page.getByRole('link', { name: new RegExp(photoGig.title) })).toBeVisible()
      await expect(page.getByRole('link', { name: new RegExp(deliveryGig.title) })).toHaveCount(0)
    })

    test('a LIVE gig detail page renders too — the bound the #24 decision rests on', async ({
      page,
    }) => {
      // #24 accepted a blank page for `notFound()` 404s on the argument that
      // the cost is bounded to DEAD links. Nothing proved the bound: the
      // JavaScript-off suite covered the feed and stopped there. If a live gig
      // page were blank as well, that decision would have been made on a false
      // premise — so this is the test that holds it to its own reasoning.
      await page.goto(`/gig/${deliveryGig.escrow_id}`)
      await expect(page.getByRole('heading', { level: 1 })).toContainText(deliveryGig.title)
      await expect(page.getByText('25 USDC').first()).toBeVisible()
    })
  })

  test('the filter rail is links and form fields — it works with no JavaScript', async ({ request }) => {
    const html = await (await request.get('/')).text()
    // A rail of buttons would be a set of filters that only exist once the
    // bundle runs, on the one page an anonymous visitor may reach first.
    expect(html).toContain('href="/?category=delivery"')
    expect(html).toContain('href="/?country=NG"')
    expect(html).toContain('<form')
    expect(html).toContain('<noscript>')
  })

  test('sort reorders the feed, and never sends the cursor the server would 400', async ({ request }) => {
    // The stub refuses cursor+sort exactly like production; a 400 would
    // surface here as an error page, not a quietly empty feed.
    const cheapFirst = await (await request.get('/?sort=amount_asc')).text()
    const dearFirst = await (await request.get('/?sort=amount_desc')).text()
    expect(cheapFirst).toContain(deliveryGig.title)
    expect(dearFirst).toContain(deliveryGig.title)
    expect(cheapFirst.indexOf(deliveryGig.title)).toBeLessThan(cheapFirst.indexOf(photoGig.title))
    expect(dearFirst.indexOf(photoGig.title)).toBeLessThan(dearFirst.indexOf(deliveryGig.title))
  })

  test('a stale cursor carried into a searched view is dropped, not forwarded', async ({ request }) => {
    // Forwarding it is a 400 from the real server. The page must still render.
    const response = await request.get('/?q=parcel&cursor=stale-cursor')
    expect(response.status()).toBe(200)
    expect(await response.text()).toContain(deliveryGig.title)
  })

  test('a page past the end says so, and keeps the search instead of clearing it', async ({ request }) => {
    // A stale page-three link, after the results it pointed at were taken.
    // The wrong answer here is "no gigs match these filters" — the query still
    // matches, the reader is just past the last of them — followed by a button
    // that throws their search away.
    const response = await request.get('/?q=parcel&offset=40')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain(FEED_COPY.pastEnd.title)
    expect(html).not.toContain(FEED_COPY.empty.title)
    expect(html).toContain('href="/?q=parcel"')
  })

  test('every view declares a canonical, and the position keys never reach it', async ({ request }) => {
    // The rail links a combinatorial URL space and robots.txt allows all of
    // it, so without this the same page competes with itself: /,
    // /?offset=0 and /?q= serve identical rendered content.
    const canonicalOf = async (url: string) => {
      const html = await (await request.get(url)).text()
      return html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? null
    }
    expect(await canonicalOf('/')).toMatch(/^https?:\/\/[^/]+$/)
    expect(await canonicalOf('/?offset=40&cursor=spent')).toMatch(/^https?:\/\/[^/]+$/)
    expect(await canonicalOf('/?sort=created_at')).toMatch(/^https?:\/\/[^/]+$/)
    // A genuine slice keeps its own address — a canonical is not a noindex.
    expect(await canonicalOf('/?category=photo&offset=20')).toMatch(
      /\/\?category=photo$/,
    )
  })

  test.describe('when the gig index is down', () => {
    const DOWN = `/?q=${E2E_FAIL_QUERY}`

    test.describe('with JavaScript disabled', () => {
      test.use({ javaScriptEnabled: false })

      test('says so, instead of rendering nothing at all', async ({ page }) => {
        // `error.tsx` is a client component: its fallback is swapped in by the
        // hydration script, so before the page handled this itself a failed
        // read rendered a BLANK page with JavaScript off — on the surface whose
        // premise is that it works without the bundle, at the moment a reader
        // most needs to be told their escrow is untouched.
        await page.goto(DOWN)
        await expect(page.getByRole('alert')).toContainText(FEED_COPY.error.title)
        await expect(page.getByRole('alert')).toContainText('read failure only')
        // The retry keeps the reader on their own view rather than dropping
        // them at the bare feed.
        await expect(page.getByRole('link', { name: new RegExp(FEED_COPY.error.action) })).toHaveAttribute(
          'href',
          DOWN,
        )
      })
    })

    test('answers 200 but forbids indexing — the front door must not cache as an error', async ({ request }) => {
      const response = await request.get(DOWN)
      expect(response.status()).toBe(200)
      expect(await response.text()).toContain('name="robots" content="noindex')
    })

    test('a healthy view alongside it is unaffected', async ({ request }) => {
      // Failure is keyed off the query, not a server flag, so the suite stays
      // parallel-safe and this proves it.
      const html = await (await request.get('/')).text()
      expect(html).toContain(deliveryGig.title)
      expect(html).not.toContain(FEED_COPY.error.title)
    })
  })

  test('category filter is a URL, and it filters', async ({ request }) => {
    const html = await (await request.get('/?category=delivery')).text()
    expect(html).toContain(deliveryGig.title)
    expect(html).not.toContain(photoGig.title)
  })

  test('an invalid filter value degrades to the full feed, not an error', async ({ request }) => {
    const response = await request.get('/?category=nonsense&chain_id=eip155:999999')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain(deliveryGig.title)
    expect(html).toContain(photoGig.title)
  })

  test('a manifest chain the deployment does not serve degrades too, and the filter offers only RUNNING chains', async ({ request }) => {
    // solana:mainnet exists in CHAIN_MANIFEST but not in this deployment's
    // registry — the server would 400 it; the page must not forward it.
    const response = await request.get('/?chain_id=solana:mainnet')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain(deliveryGig.title)
    // The select is built from GET /v1/platform/chains, never the manifest.
    expect(html).toContain('Solana Devnet')
    expect(html).toContain('Base Sepolia')
    expect(html).not.toContain('Celo Sepolia')
  })

  test.describe('on a phone', () => {
    // 360 and 390 are the two commonest widths in this product's markets; 320
    // is the floor. The public feed is the anonymous front door and most of
    // that traffic is mobile, so a page that scrolls sideways here is not a
    // detail — it is the first thing a new visitor sees.
    // The feed carries `unbreakableGig` — a pasted link in the title and the
    // longest real place name — so these widths are measured against
    // poster-written text at its nastiest, not against tidy fixtures.
    const PATHS = [
      '/',
      `/gig/${deliveryGigDetail.escrow_id}`,
      `/gig/${unbreakableGigDetail.escrow_id}`,
    ]
    for (const width of [320, 360, 390]) {
      test(`no public page scrolls sideways at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 780 })
        for (const path of PATHS) {
          await page.goto(path)
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          )
          expect(overflow, `${path} overflowed by ${overflow}px at ${width}px`).toBe(0)
        }
      })
    }

    test('the desktop widths hold too — the grid track count changes the failure', async ({ page }) => {
      // 768 and 1100 overflowed while 900 did not: the card grid switches
      // between one, two and three columns, and only some track widths are
      // narrower than the longest token. Checking one width would have missed
      // it, so this checks the ones where the column count changes.
      for (const width of [768, 900, 1100, 1280]) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/')
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
          expect(overflow, `/ overflowed by ${overflow}px at ${width}px`).toBe(0)
      }
    })

    test('keeps the way in and Support reachable, dropping only the duplicate link', async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 780 })
      await page.goto('/')
      await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Support' })).toBeVisible()
      // "Browse gigs" points where the wordmark already points, so it is the
      // one the row can afford to lose — the destination stays reachable.
      await expect(page.getByRole('link', { name: 'Browse gigs' })).toBeHidden()
      await expect(page.getByRole('link', { name: 'Tenda' })).toHaveAttribute('href', '/')
    })
  })

  test('hydrates cleanly and navigates card → detail', async ({ page }) => {
    const failures = captureRuntimeFailures(page)
    await page.goto('/')
    await page.getByRole('link', { name: new RegExp(deliveryGig.title) }).click()
    await expect(page.getByRole('heading', { name: deliveryGig.title })).toBeVisible()
    expect(failures).toEqual([])
  })
})
