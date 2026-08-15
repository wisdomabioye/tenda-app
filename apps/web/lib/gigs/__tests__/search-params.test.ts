/**
 * URL-param parsing for the public feed. The load-bearing behavior: invalid
 * values are DROPPED (the server 400s unknown chain/category rather than
 * returning an empty page), and hrefs keep filters linkable.
 */
import {
  GIGS_PAGE_SIZE,
  gigsHref,
  parseGigFeedFilters as parse,
  toGigListQuery,
  type RawSearchParams,
} from '@/lib/gigs/search-params'

// The running registry as the page resolves it (listEnabledChains) — dev chains.
const ENABLED = new Set(['solana:devnet', 'eip155:84532'])
const parseGigFeedFilters = (params: RawSearchParams) => parse(params, ENABLED)

describe('parseGigFeedFilters', () => {
  it('accepts valid values', () => {
    const filters = parseGigFeedFilters({
      category: 'delivery',
      city: 'Lagos',
      chain_id: 'solana:devnet',
      remote: 'true',
      q: 'urgent',
      cursor: 'abc',
    })
    expect(filters).toEqual({
      category: 'delivery',
      city: 'Lagos',
      chain_id: 'solana:devnet',
      remote: true,
      q: 'urgent',
      cursor: 'abc',
    })
  })

  it('drops unknown categories and chain ids instead of forwarding a 400', () => {
    const filters = parseGigFeedFilters({ category: 'plumbing', chain_id: 'eip155:999999' })
    expect(filters.category).toBeNull()
    expect(filters.chain_id).toBeNull()
  })

  it('drops a MANIFEST chain the running registry does not serve — the 400 the server would throw', () => {
    // solana:mainnet is real in CHAIN_MANIFEST but not provisioned on this
    // deployment; forwarding it turns a filter click into an error page.
    expect(parseGigFeedFilters({ chain_id: 'solana:mainnet' }).chain_id).toBeNull()
  })

  it('treats empty and whitespace values as absent', () => {
    const filters = parseGigFeedFilters({ city: '  ', q: '', cursor: undefined })
    expect(filters.city).toBeNull()
    expect(filters.q).toBeNull()
    expect(filters.cursor).toBeNull()
  })

  it('takes the first value of a repeated param', () => {
    expect(parseGigFeedFilters({ category: ['photo', 'errand'] }).category).toBe('photo')
  })

  it('remote is only true for the literal "true"', () => {
    expect(parseGigFeedFilters({ remote: '1' }).remote).toBe(false)
    expect(parseGigFeedFilters({}).remote).toBe(false)
  })
})

describe('toGigListQuery', () => {
  it('maps set filters and omits unset ones', () => {
    const query = toGigListQuery(parseGigFeedFilters({ category: 'service', remote: 'true' }))
    expect(query).toEqual({
      category: 'service',
      city: undefined,
      chain_id: undefined,
      remote: true,
      q: undefined,
      cursor: undefined,
      limit: GIGS_PAGE_SIZE,
    })
  })
})

describe('gigsHref', () => {
  const base = parseGigFeedFilters({ category: 'delivery', city: 'Lagos' })

  it('keeps existing filters and applies changes', () => {
    expect(gigsHref(base, { category: 'photo' })).toBe('/gigs?category=photo&city=Lagos')
  })

  it('null clears a key; a fully cleared set is the bare path', () => {
    expect(gigsHref(base, { category: null, city: null })).toBe('/gigs')
  })

  it('drops the cursor on filter changes but carries it when passed explicitly', () => {
    const withCursor = parseGigFeedFilters({ category: 'delivery', cursor: 'page2' })
    expect(gigsHref(withCursor, { category: 'photo' })).not.toContain('cursor')
    expect(gigsHref(withCursor, { cursor: 'page3' })).toContain('cursor=page3')
  })
})
