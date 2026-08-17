import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'
import { CATEGORY_LABELS } from '@tenda/shared'
import { FEED_COPY } from '../components/gig/feed/copy'
import {
  deliveryGig,
  deliveryGigDetail,
  LEAKED_COUNTERPARTY_ID,
  LEAKED_COUNTERPARTY_NAME,
  photoGig,
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
