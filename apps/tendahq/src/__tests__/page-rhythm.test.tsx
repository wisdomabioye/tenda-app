import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LandingPage } from '../App'
import { FOOTER_NAV_LINKS } from '@/components/sections/footer/content/sitemap'
import { renderedSections } from '@/test-support/rendered-sections'

/**
 * Two whole-page invariants that no single section can check about itself, and
 * that adding a section is precisely what breaks.
 *
 * Both were found by inserting the Networks section: it landed as `base`
 * directly above a `base` FAQ, putting two identical surfaces side by side, and
 * it added a footer link whose target nothing verified existed.
 *
 * Since #55 the surface is derived from position, so a collision can no longer
 * be created by hand — which changes what the rhythm assertion is FOR rather
 * than retiring it. It is now the end-to-end proof that the derivation reaches
 * the rendered page: a section that ignores the prop and hardcodes a surface
 * still lands here as a collision the moment its position disagrees with it.
 */
const html = renderToStaticMarkup(<LandingPage />)

/** The page's own sections, parsed the same way the per-section suite parses one. */
const sections = () => renderedSections(html)

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
