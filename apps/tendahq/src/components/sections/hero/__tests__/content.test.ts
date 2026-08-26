import { describe, expect, it } from 'vitest'
import { APP_INFO, FEE_PCT, TRADE_MARKET_COUNT } from '@/content'
import { HERO_CONTENT, HERO_STATS_FALLBACK, FEE_STAT_INDEX } from '../content'

/**
 * The hero states four numbers above the fold, and two of them are configured
 * elsewhere. This pins them to their sources and guards the one silent-failure
 * mode in how the live fee reaches the row.
 */
describe('hero stats', () => {
  /**
   * FEE_STAT_INDEX is a findIndex over a label. A miss returns -1, which no
   * array index equals, so HeroStatRow would silently keep rendering the
   * default fee forever — no error, no blank, just a stale number above the
   * fold. Renaming the label is the plausible way to cause it.
   */
  it('resolves the live-fee cell — a miss would silently freeze the fee', () => {
    expect(FEE_STAT_INDEX).toBeGreaterThanOrEqual(0)
    expect(HERO_STATS_FALLBACK[FEE_STAT_INDEX]).toBeDefined()
  })

  it('points that index at the fee cell and no other', () => {
    expect(HERO_STATS_FALLBACK[FEE_STAT_INDEX].value).toBe(`${FEE_PCT}%`)
    const feeCells = HERO_STATS_FALLBACK.filter((s) => s.value.endsWith('%') && s.value !== '100%')
    expect(feeCells).toHaveLength(1)
  })

  /**
   * Both derived cells. The fee was typed as "2.5%" here while every other
   * surface had been moved onto the shared default, and the markets count was
   * typed as "3" while being overridden from the payout registry downstream.
   */
  it('derives the fee and the market count rather than stating them', () => {
    expect(HERO_STATS_FALLBACK[FEE_STAT_INDEX].value).toBe(`${FEE_PCT}%`)
    const markets = HERO_STATS_FALLBACK.find((s) => s.label === 'Fiat markets')
    expect(markets?.value).toBe(String(TRADE_MARKET_COUNT))
  })

  it('labels every cell uniquely, since the fee cell is found by label', () => {
    const labels = HERO_STATS_FALLBACK.map((s) => s.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('stamps the release from the derived version and stage', () => {
    expect(HERO_CONTENT.stamps.versionLabel).toBe(
      `${APP_INFO.versionNumber} · ${APP_INFO.chains.stage}`,
    )
    expect(HERO_CONTENT.stamps.liveLabel).toContain(APP_INFO.chains.networksLine)
  })
})
