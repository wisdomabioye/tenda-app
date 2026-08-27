import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LandingPage } from '../App'
import { FOOTER_NAV_LINKS } from '@/components/sections/footer/content/sitemap'

/**
 * Two whole-page invariants that no single section can check about itself, and
 * that adding a section is precisely what breaks.
 *
 * Both were found by inserting the Networks section: it landed as `base`
 * directly above a `base` FAQ, putting two identical surfaces side by side, and
 * it added a footer link whose target nothing verified existed.
 */
const html = renderToStaticMarkup(<LandingPage />)

/**
 * Every `<section>` in document order, with the surface it rendered.
 *
 * The id is OPTIONAL. An earlier version of this matcher required `id="..."`,
 * which silently excluded the hero — SectionShell renders an id only when one
 * is passed — so a test claiming no two adjacent sections share a surface was
 * in fact not looking at the first pair on the page. Sections without an id are
 * labelled by position so the failure message still says which pair collided.
 */
function sections(): { id: string; surface: 'base' | 'alt' }[] {
  const out: { id: string; surface: 'base' | 'alt' }[] = []
  let index = 0
  for (const match of html.matchAll(/<section(?: id="([^"]*)")?[^>]*class="([^"]*)"/g)) {
    const [, id, className] = match
    index += 1
    // SectionShell renders exactly one of these two background tokens. The
    // closing paren on `--surface-bg)` is what keeps it from also matching
    // `--surface-bg-alt)`.
    const alt = className.includes('--surface-bg-alt)')
    const base = className.includes('--surface-bg)')
    if (!alt && !base) continue
    out.push({ id: id ?? `section#${index}`, surface: alt ? 'alt' : 'base' })
  }
  return out
}

describe('page rhythm', () => {
  it('renders the sections it is supposed to', () => {
    const ids = sections().map((s) => s.id)
    expect(ids).toContain('networks')
    expect(ids).toContain('faq')
    expect(ids.length).toBeGreaterThan(5)
  })

  /**
   * The invariant. Adjacent sections must differ, or the boundary between them
   * is invisible. Asserted pairwise rather than as an expected list, so a new
   * section is checked automatically instead of needing this test updated.
   */
  it('never places two sections of the same surface side by side', () => {
    const list = sections()
    const collisions = list
      .slice(1)
      .map((s, i) => ({ prev: list[i], next: s }))
      .filter(({ prev, next }) => prev.surface === next.surface)
      .map(({ prev, next }) => `${prev.id}(${prev.surface}) → ${next.id}(${next.surface})`)
    expect(collisions).toEqual([])
  })
})

describe('footer navigation', () => {
  /**
   * A footer anchor pointing at an id no section renders is a dead link that
   * looks alive: clicking it simply does nothing, and nothing else in the suite
   * would notice.
   */
  it('points every in-page anchor at a section that exists', () => {
    const ids = new Set(sections().map((s) => s.id))
    const anchors = FOOTER_NAV_LINKS.filter((l) => l.href.startsWith('/#')).map((l) =>
      l.href.slice(2),
    )
    expect(anchors.length).toBeGreaterThan(0)
    for (const anchor of anchors) {
      expect([...ids]).toContain(anchor)
    }
  })
})
