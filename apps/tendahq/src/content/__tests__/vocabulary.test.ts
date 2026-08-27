import { describe, expect, it } from 'vitest'
import {
  SUPPORTED_CURRENCIES as SHARED_CURRENCIES,
  CURRENCY_META,
} from '@tenda/shared/constants/currencies'
import {
  GIG_CATEGORIES as SHARED_CATEGORIES,
  CATEGORY_LABELS,
} from '@tenda/shared/constants/categories'
import { CURRENCIES, CURRENCY_LIST, SUPPORTED_CURRENCIES } from '../currencies'
import { CATEGORIES, CATEGORY_LABELS_LINE, GIG_CATEGORIES } from '../categories'

/**
 * The landing kept its OWN copy of both vocabularies, and both had drifted:
 * currencies omitted AED (so the page rendered a display count of 8 for a
 * product supporting 9), and categories labelled `photo` "Photo" where shared
 * deliberately says "Creative", carrying icons a recorded product decision had
 * rejected.
 *
 * A copy cannot be caught by testing the copy — it agrees with itself. These
 * tests are written against SHARED as the authority, so they fail if the
 * landing ever reintroduces a local list, and they are the reason deleting the
 * copies is safe rather than merely tidy.
 */
describe('display currencies', () => {
  it('is exactly shared’s vocabulary, in shared’s order', () => {
    expect([...SUPPORTED_CURRENCIES]).toEqual([...SHARED_CURRENCIES])
  })

  /**
   * The specific regression. AED is asserted BY NAME rather than by count,
   * because a count assertion passes again the moment any ninth currency is
   * added — including a wrong one.
   */
  it('includes AED, the currency the deleted copy omitted', () => {
    expect(SUPPORTED_CURRENCIES).toContain('AED')
    expect(CURRENCIES.AED.name).toBe('UAE Dirham')
  })

  it('carries shared’s symbol, name, flag and locale for every currency', () => {
    for (const code of SHARED_CURRENCIES) {
      const shared = CURRENCY_META[code]
      expect(CURRENCIES[code]).toEqual({
        code,
        symbol: shared.symbol,
        name: shared.name,
        flag: shared.flag,
        locale: shared.locale,
      })
    }
  })

  /**
   * `coingeckoKey` is a server pricing detail. It rides on shared's row, and a
   * spread would have carried it onto every object the marketing page holds
   * while the local interface claimed five fields.
   */
  it('does not leak shared’s server-side pricing key onto the display rows', () => {
    for (const row of CURRENCY_LIST) {
      expect(Object.keys(row).sort()).toEqual(['code', 'flag', 'locale', 'name', 'symbol'])
    }
  })

  it('lists every currency once, in vocabulary order', () => {
    expect(CURRENCY_LIST.map((c) => c.code)).toEqual([...SHARED_CURRENCIES])
  })
})

describe('gig categories', () => {
  it('is exactly shared’s vocabulary, in shared’s order', () => {
    expect([...GIG_CATEGORIES]).toEqual([...SHARED_CATEGORIES])
  })

  /**
   * The specific regression, asserted on the one category whose label differs
   * from its key. Shared's docstring records why: mobile shipped both "Photo"
   * and "Creative" for this category, and the consolidation ended it. The
   * landing had reopened the split.
   */
  it('labels `photo` "Creative", as shared does — not "Photo"', () => {
    expect(CATEGORIES.photo.label).toBe('Creative')
    expect(CATEGORIES.photo.label).not.toBe('Photo')
  })

  it('takes every label from shared rather than restating it', () => {
    for (const id of SHARED_CATEGORIES) {
      expect(CATEGORIES[id].label).toBe(CATEGORY_LABELS[id])
    }
  })

  /**
   * Emoji is the one thing decided locally, so it is the one thing that can go
   * missing when a category is added to shared. The Record is total, which
   * makes that a compile error — this covers the case where a key exists but
   * was filled in with an empty string.
   */
  it('gives every category a non-empty chip glyph', () => {
    for (const id of SHARED_CATEGORIES) {
      expect(CATEGORIES[id].emoji).not.toBe('')
      expect(CATEGORIES[id].id).toBe(id)
    }
  })

  it('builds the panel stat line from labels, not from the enum keys', () => {
    expect(CATEGORY_LABELS_LINE).toBe(SHARED_CATEGORIES.map((id) => CATEGORY_LABELS[id]).join(' · '))
    expect(CATEGORY_LABELS_LINE).toContain('Creative')
    expect(CATEGORY_LABELS_LINE).not.toContain('photo')
  })
})
