import { describe, expect, it } from 'vitest'
import { GIG_CATEGORIES } from '@/content/categories'
import { LANDING_CHAINS } from '../chains'
import { ECOSYSTEMS_HEADER, ECOSYSTEM_PANELS } from '../ecosystems'
import {
  EXAMPLE_TASKS,
  PAYOUT_MARKET_CODES,
  REMOTE_CITY,
  REMOTE_FLAG,
  TASK_COUNTRIES,
  flagFor,
} from '../tasks'
import { EXAMPLE_TRADES } from '../trades'

/**
 * The showcased datasets and the ecosystem panels read as product screenshots.
 * A row that names something the product cannot do is a promise it breaks, and
 * these are all hand-curated files where the next edit is the risk.
 */
describe('ecosystem panels', () => {
  it('shows a panel for a chain the manifest actually ships', () => {
    const families = LANDING_CHAINS.map((c) => c.family)
    for (const panel of ECOSYSTEM_PANELS) {
      expect(families).toContain(panel.chainFamily)
    }
  })

  it('gives every shipped chain a panel', () => {
    const panelled = ECOSYSTEM_PANELS.map((p) => p.chainFamily)
    for (const chain of LANDING_CHAINS) {
      expect(panelled).toContain(chain.family)
    }
  })

  /**
   * The eyebrow said "three ecosystems" beside a panel list built from the
   * manifest, so a fourth chain would have contradicted the grid below it.
   */
  it('counts ecosystems in the eyebrow from the manifest, not by hand', () => {
    expect(ECOSYSTEMS_HEADER.eyebrow).toContain(String(LANDING_CHAINS.length))
  })

  /**
   * The empty-string guard is load-bearing: `toContain('')` is vacuously true,
   * so without it this assertion passes for a chain whose strength was
   * deleted — which is precisely the drift it exists to catch.
   */
  it('explains every chain it names in the sub-head', () => {
    for (const chain of LANDING_CHAINS) {
      expect(chain.strength).not.toBe('')
      expect(ECOSYSTEMS_HEADER.sub).toContain(chain.strength)
      expect(ECOSYSTEMS_HEADER.sub).toContain(chain.name)
    }
  })

  it('gives every panel at least one shipped proof point', () => {
    for (const panel of ECOSYSTEM_PANELS) {
      expect(panel.why).not.toBe('')
      expect(panel.proofs.filter((p) => p.roadmap !== true).length).toBeGreaterThan(0)
    }
  })

  /**
   * A roadmap proof must be FLAGGED, never phrased as shipped. The Base
   * sponsorship rail sat here as an unflagged-looking "in progress" item while
   * its build path was known-invalid.
   */
  it('never phrases a roadmap proof as already available', () => {
    for (const panel of ECOSYSTEM_PANELS) {
      for (const proof of panel.proofs) {
        if (proof.roadmap === true) continue
        expect(proof.label.toLowerCase()).not.toContain('coming')
        expect(proof.label.toLowerCase()).not.toContain('in progress')
      }
    }
  })
})

describe('showcased gigs', () => {
  it('uses only real gig categories', () => {
    for (const task of EXAMPLE_TASKS) {
      expect(GIG_CATEGORIES).toContain(task.category)
    }
  })

  it('gives every showcased row a unique id', () => {
    for (const rows of [EXAMPLE_TASKS.map((t) => t.id), EXAMPLE_TRADES.map((t) => t.id)]) {
      expect(new Set(rows).size).toBe(rows.length)
    }
  })

  /** Gigs are USDC-only on every chain, and the deck prices them in USDC. */
  it('prices every showcased gig positively', () => {
    for (const task of EXAMPLE_TASKS) {
      expect(task.amountUsdc).toBeGreaterThan(0)
    }
  })

  it('showcases trades only on chains the manifest ships', () => {
    const families = LANDING_CHAINS.map((c) => c.family)
    for (const trade of EXAMPLE_TRADES) {
      expect(families).toContain(trade.asset.chainFamily)
    }
  })
})

/**
 * The showcased gigs name real places, and a place is a claim: a worker there
 * has to be able to actually get paid. These pin the sample deck to the payout
 * registry so "somewhere plausible" cannot be typed into a seed row.
 */
describe('showcased gigs name markets we settle in', () => {
  it('names only countries the payout registry supports', () => {
    for (const country of TASK_COUNTRIES) {
      expect(PAYOUT_MARKET_CODES).toContain(country)
    }
  })

  /**
   * The other direction, and the one that catches an Africa-only deck: every
   * market the product settles should appear somewhere in the samples, or the
   * page shows a narrower footprint than the product has.
   */
  it('shows a gig in every market the registry settles', () => {
    for (const code of PAYOUT_MARKET_CODES) {
      expect(TASK_COUNTRIES).toContain(code)
    }
  })

  it('gives every located gig its own market’s flag', () => {
    for (const task of EXAMPLE_TASKS) {
      expect(task.flag).toBe(flagFor(task.country))
      expect(task.flag).not.toBe('')
    }
  })

  /**
   * `flagFor` falls back to the globe, so a market added to the registry
   * without a flag renders a plausible-looking wrong glyph rather than an
   * obvious blank. That is precisely why it is asserted here instead of being
   * left to the eye.
   */
  it('has a distinct flag for every payout market, not the remote fallback', () => {
    for (const code of PAYOUT_MARKET_CODES) {
      expect(flagFor(code)).not.toBe(REMOTE_FLAG)
    }
  })

  it('marks remote work as remote in both the city and the flag', () => {
    for (const task of EXAMPLE_TASKS) {
      if (task.country !== null) continue
      expect(task.city).toBe(REMOTE_CITY)
      expect(task.flag).toBe(REMOTE_FLAG)
    }
  })

  /**
   * A located gig must not be labelled "Remote", which would pair a country
   * flag with a city claiming no location.
   */
  it('never labels a located gig as remote', () => {
    for (const task of EXAMPLE_TASKS) {
      if (task.country === null) continue
      expect(task.city).not.toBe(REMOTE_CITY)
    }
  })

  /**
   * The deck is deliberately weighted away from being Africa-only (user
   * decision). Asserted as a proportion of LOCATED gigs rather than a fixed
   * count, so adding samples cannot silently tip it back.
   */
  it('does not read as an Africa-only marketplace', () => {
    const AFRICAN = ['NG', 'KE', 'GH', 'ZA']
    const located = EXAMPLE_TASKS.filter((t) => t.country !== null)
    const african = located.filter((t) => AFRICAN.includes(t.country as string))
    expect(african.length).toBeLessThan(located.length / 2)
  })

  /** Titles are sized for the card; the deck wraps and breaks its grid past this. */
  it('keeps every title short enough for a card', () => {
    for (const task of EXAMPLE_TASKS) {
      expect(task.title.length).toBeLessThanOrEqual(45)
    }
  })
})
