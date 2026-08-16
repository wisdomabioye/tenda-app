import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SURFACE_TITLE,
  selectionKey,
  surfaceTitle,
} from '@/components/app/workspace/surfaces'

describe('surfaceTitle', () => {
  it.each([
    ['messages', 'Messages'],
    ['my-gigs', 'My Gigs'],
    ['settings', 'Settings'],
    ['exchange', 'Trade'],
  ])('names the %s surface', (segment, title) => {
    expect(surfaceTitle(segment)).toBe(title)
  })

  it('falls back for an unregistered surface rather than rendering an empty name', () => {
    expect(surfaceTitle('brand-new-surface')).toBe(DEFAULT_SURFACE_TITLE)
  })

  it('falls back when there is no active segment at all', () => {
    expect(surfaceTitle(null)).toBe(DEFAULT_SURFACE_TITLE)
  })
})

describe('selectionKey', () => {
  it('is null on a bare surface — nothing is selected', () => {
    expect(selectionKey(['messages'])).toBeNull()
  })

  it('is null for no segments', () => {
    expect(selectionKey([])).toBeNull()
  })

  it('identifies the open row', () => {
    expect(selectionKey(['messages', 'abc-123'])).toBe('abc-123')
  })

  it('distinguishes a deeper view of the same row', () => {
    // /gig/<id> and /gig/<id>/applicants are different selections, so the
    // detail pane hands off focus when moving between them.
    expect(selectionKey(['gig', 'g1'])).toBe('g1')
    expect(selectionKey(['gig', 'g1', 'applicants'])).toBe('g1/applicants')
  })

  it('ignores route groups, which are not part of the URL', () => {
    expect(selectionKey(['(authed)', 'post'])).toBeNull()
    expect(selectionKey(['settings', '(panels)', 'security'])).toBe('security')
  })

  it('ignores parallel-route slots, which are not part of the URL either', () => {
    expect(selectionKey(['@list', 'messages'])).toBeNull()
    expect(selectionKey(['messages', '@modal', 'abc'])).toBe('abc')
  })

  it('treats two different rows as different selections', () => {
    expect(selectionKey(['messages', 'a'])).not.toBe(selectionKey(['messages', 'b']))
  })
})
