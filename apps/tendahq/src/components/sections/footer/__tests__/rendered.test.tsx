import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { HealthResponse } from '@/api/platform'
import { asText } from '@/test-support/html-text'
import { ThemeContext, type ThemeContextValue } from '@/theme/theme-context'
import { Footer } from '../Footer'
import { FooterStatus } from '../FooterStatus'
import { FOOTER_COLUMNS, FOOTER_LEGAL } from '../content'

interface Health {
  data: HealthResponse | null
  loading: boolean
  error: Error | null
}

/** The hook is a network effect; the chip's honesty is what is under test. */
const health = vi.hoisted(() => ({
  state: { data: null, loading: true, error: null } as Health,
}))
vi.mock('@/hooks/useHealth', () => ({ useHealth: () => health.state }))

/** The wordmark picks its artwork by theme, so the footer needs one to render. */
const theme: ThemeContextValue = { mode: 'light', resolved: 'light', setMode: () => undefined, toggle: () => undefined }

const html = renderToStaticMarkup(
  <MemoryRouter>
    <ThemeContext.Provider value={theme}>
      <Footer />
    </ThemeContext.Provider>
  </MemoryRouter>,
)

describe('the footer', () => {
  it('renders every column link with the right kind of href', () => {
    for (const link of FOOTER_COLUMNS.flatMap((c) => c.links)) {
      const at = html.indexOf(`href="${link.href}"`)
      expect(at).toBeGreaterThan(-1)
      const tag = html.slice(html.lastIndexOf('<a', at), html.indexOf('>', at))
      // Only a link that leaves the site opens a new tab, and it says so.
      expect(tag.includes('target="_blank"')).toBe(link.external === true)
      expect(tag.includes('rel="noreferrer"')).toBe(link.external === true)
      expect(html).toContain(`>${asText(link.label)}</a>`)
    }
  })

  it('carries the release line and the disclaimer', () => {
    expect(html).toContain(asText(FOOTER_LEGAL.release))
    expect(html).toContain(asText(FOOTER_LEGAL.disclaimer))
  })
})

describe('the status chip', () => {
  const chip = (state: Health) => {
    health.state = state
    return renderToStaticMarkup(<FooterStatus />)
  }
  const ok: HealthResponse = { status: 'ok', uptime: 1 }

  it('says it is still checking before the endpoint has answered', () => {
    const out = chip({ data: null, loading: true, error: null })
    expect(out).toContain(FOOTER_LEGAL.status.checking)
    for (const other of [FOOTER_LEGAL.status.ok, FOOTER_LEGAL.status.degraded, FOOTER_LEGAL.status.down]) {
      expect(out).not.toContain(other)
    }
  })

  it('reports normal only when the endpoint says ok', () => {
    expect(chip({ data: ok, loading: false, error: null })).toContain(FOOTER_LEGAL.status.ok)
    const degraded = chip({ data: { ...ok, status: 'degraded' }, loading: false, error: null })
    expect(degraded).toContain(FOOTER_LEGAL.status.degraded)
    expect(degraded).not.toContain(FOOTER_LEGAL.status.ok)
  })

  it('says unavailable when the endpoint cannot be reached, never normal', () => {
    const out = chip({ data: null, loading: false, error: new Error('ECONNREFUSED') })
    expect(out).toContain(FOOTER_LEGAL.status.down)
    expect(out).not.toContain(FOOTER_LEGAL.status.ok)
    expect(out).not.toContain(FOOTER_LEGAL.status.checking)
  })
})
