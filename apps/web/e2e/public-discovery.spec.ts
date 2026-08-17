import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'
import { CATEGORY_LABELS } from '@tenda/shared'
import { FEED_COPY } from '../components/gig/feed/copy'
import {
  deliveryGig,
  E2E_FAIL_QUERY,
  deliveryGigDetail,
  LEAKED_COUNTERPARTY_ID,
  LEAKED_COUNTERPARTY_NAME,
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


test.describe('feed — /gigs', () => {
  test('is server-rendered: raw HTML carries titles and amounts, no JS needed', async ({ request }) => {
    const response = await request.get('/gigs')
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
  })

  test.describe('with JavaScript disabled', () => {
    test.use({ javaScriptEnabled: false })

    test('the feed renders, reads correctly, and every filter still works', async ({ page }) => {
      await page.goto('/gigs')
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
      // not use. `exact` separates the rail link from the card that contains
      // the same word.
      await page.getByRole('link', { name: CATEGORY_LABELS.photo, exact: true }).click()
      await expect(page).toHaveURL(/category=photo/)
      await expect(page.getByRole('link', { name: new RegExp(photoGig.title) })).toBeVisible()
      await expect(page.getByRole('link', { name: new RegExp(deliveryGig.title) })).toHaveCount(0)
    })
  })

  test('the filter rail is links and form fields — it works with no JavaScript', async ({ request }) => {
    const html = await (await request.get('/gigs')).text()
    // A rail of buttons would be a set of filters that only exist once the
    // bundle runs, on the one page an anonymous visitor may reach first.
    expect(html).toContain('href="/gigs?category=delivery"')
    expect(html).toContain('href="/gigs?country=NG"')
    expect(html).toContain('<form')
    expect(html).toContain('<noscript>')
  })

  test('sort reorders the feed, and never sends the cursor the server would 400', async ({ request }) => {
    // The stub refuses cursor+sort exactly like production; a 400 would
    // surface here as an error page, not a quietly empty feed.
    const cheapFirst = await (await request.get('/gigs?sort=amount_asc')).text()
    const dearFirst = await (await request.get('/gigs?sort=amount_desc')).text()
    expect(cheapFirst).toContain(deliveryGig.title)
    expect(dearFirst).toContain(deliveryGig.title)
    expect(cheapFirst.indexOf(deliveryGig.title)).toBeLessThan(cheapFirst.indexOf(photoGig.title))
    expect(dearFirst.indexOf(photoGig.title)).toBeLessThan(dearFirst.indexOf(deliveryGig.title))
  })

  test('a stale cursor carried into a searched view is dropped, not forwarded', async ({ request }) => {
    // Forwarding it is a 400 from the real server. The page must still render.
    const response = await request.get('/gigs?q=parcel&cursor=stale-cursor')
    expect(response.status()).toBe(200)
    expect(await response.text()).toContain(deliveryGig.title)
  })

  test('a page past the end says so, and keeps the search instead of clearing it', async ({ request }) => {
    // A stale page-three link, after the results it pointed at were taken.
    // The wrong answer here is "no gigs match these filters" — the query still
    // matches, the reader is just past the last of them — followed by a button
    // that throws their search away.
    const response = await request.get('/gigs?q=parcel&offset=40')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain(FEED_COPY.pastEnd.title)
    expect(html).not.toContain(FEED_COPY.empty.title)
    expect(html).toContain('href="/gigs?q=parcel"')
  })

  test('every view declares a canonical, and the position keys never reach it', async ({ request }) => {
    // The rail links a combinatorial URL space and robots.txt allows all of
    // it, so without this the same page competes with itself: /gigs,
    // /gigs?offset=0 and /gigs?q= serve identical rendered content.
    const canonicalOf = async (url: string) => {
      const html = await (await request.get(url)).text()
      return html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? null
    }
    expect(await canonicalOf('/gigs')).toMatch(/\/gigs$/)
    expect(await canonicalOf('/gigs?offset=40&cursor=spent')).toMatch(/\/gigs$/)
    expect(await canonicalOf('/gigs?sort=created_at')).toMatch(/\/gigs$/)
    // A genuine slice keeps its own address — a canonical is not a noindex.
    expect(await canonicalOf('/gigs?category=photo&offset=20')).toMatch(
      /\/gigs\?category=photo$/,
    )
  })

  test.describe('when the gig index is down', () => {
    const DOWN = `/gigs?q=${E2E_FAIL_QUERY}`

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
      const html = await (await request.get('/gigs')).text()
      expect(html).toContain(deliveryGig.title)
      expect(html).not.toContain(FEED_COPY.error.title)
    })
  })

  test('category filter is a URL, and it filters', async ({ request }) => {
    const html = await (await request.get('/gigs?category=delivery')).text()
    expect(html).toContain(deliveryGig.title)
    expect(html).not.toContain(photoGig.title)
  })

  test('an invalid filter value degrades to the full feed, not an error', async ({ request }) => {
    const response = await request.get('/gigs?category=nonsense&chain_id=eip155:999999')
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain(deliveryGig.title)
    expect(html).toContain(photoGig.title)
  })

  test('a manifest chain the deployment does not serve degrades too, and the filter offers only RUNNING chains', async ({ request }) => {
    // solana:mainnet exists in CHAIN_MANIFEST but not in this deployment's
    // registry — the server would 400 it; the page must not forward it.
    const response = await request.get('/gigs?chain_id=solana:mainnet')
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
      '/gigs',
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
        await page.goto('/gigs')
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, `/gigs overflowed by ${overflow}px at ${width}px`).toBe(0)
      }
    })

    test('keeps the way in and Support reachable, dropping only the duplicate link', async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 780 })
      await page.goto('/gigs')
      await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Support' })).toBeVisible()
      // "Browse gigs" points where the wordmark already points, so it is the
      // one the row can afford to lose — the destination stays reachable.
      await expect(page.getByRole('link', { name: 'Browse gigs' })).toBeHidden()
      await expect(page.getByRole('link', { name: 'Tenda' })).toHaveAttribute('href', '/gigs')
    })
  })

  test('hydrates cleanly and navigates card → detail', async ({ page }) => {
    const failures = captureRuntimeFailures(page)
    await page.goto('/gigs')
    await page.getByRole('link', { name: new RegExp(deliveryGig.title) }).click()
    await expect(page.getByRole('heading', { name: deliveryGig.title })).toBeVisible()
    expect(failures).toEqual([])
  })
})

test.describe('detail — /gig/[id]', () => {
  test('server-renders listing content with OG tags from the same fetch', async ({ request }) => {
    const html = await (await request.get(`/gig/${deliveryGigDetail.escrow_id}`)).text()
    expect(html).toContain(deliveryGigDetail.title)
    expect(html).toContain('25 USDC')
    expect(html).toContain(
      `<link rel="canonical" href="http://127.0.0.1:3211/gig/${deliveryGigDetail.escrow_id}"`,
    )
    expect(html).toContain(`<meta property="og:title" content="${deliveryGigDetail.title}"`)
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"')
    expect(html).toContain('opengraph-image')
  })

  test('never renders party-scoped fields, even when a hostile server sends them', async ({ request }) => {
    // The stub deliberately POPULATES counterparty + assigned_counterparty_id.
    const html = await (await request.get(`/gig/${deliveryGigDetail.escrow_id}`)).text()
    expect(html).not.toContain(LEAKED_COUNTERPARTY_NAME)
    expect(html).not.toContain(LEAKED_COUNTERPARTY_ID)
    expect(html).not.toContain('payment_proof')
  })

  test('a hidden gig is a 404 with noindex', async ({ request }) => {
    const response = await request.get('/gig/hidden-gig')
    expect(response.status()).toBe(404)
    const html = await response.text()
    expect(html).toContain('noindex')
  })

  test('serves a real OG image', async ({ request }) => {
    const detailHtml = await (await request.get(`/gig/${deliveryGigDetail.escrow_id}`)).text()
    const match = detailHtml.match(/<meta property="og:image" content="([^"]+)"/)
    expect(match).not.toBeNull()
    const image = await request.get(match![1])
    expect(image.status()).toBe(200)
    expect(image.headers()['content-type']).toContain('image/png')
  })
})

test.describe('SEO surfaces', () => {
  test('robots.txt allows crawling and names the sitemap', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text()
    expect(body).toContain('Allow: /')
    expect(body).toContain('/sitemap.xml')
  })

  test('sitemap.xml lists the feed, live gig urls and the support centre', async ({ request }) => {
    const body = await (await request.get('/sitemap.xml')).text()
    expect(body).toContain('/gigs')
    expect(body).toContain(`/gig/${deliveryGig.escrow_id}`)
    expect(body).toContain('/support')
    expect(body).toContain('/support/escrow')
  })
})
