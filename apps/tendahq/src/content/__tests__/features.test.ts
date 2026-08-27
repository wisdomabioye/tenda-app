import { describe, expect, it } from 'vitest'
import { ACTIVE_GAS_POLICIES, LANDING_CHAINS, chainsByGasPolicy } from '../chains'
import { GAS_FREE_START_SENTENCE, ONBOARDING_FEATURES, featureFor, gasFreeSentence } from '../features'

/**
 * The onboarding cards are the page's claim that gas is not in your way. Two
 * things must hold and neither is visible by reading the file: every card's
 * chain names come from the manifest, and no card in `live` describes a rail
 * the code cannot perform (the Base paymaster shipped as "in progress" on a
 * build path that is invalid ERC-4337 — that is what these guard against).
 */
describe('onboarding features', () => {
  it('derives one card per gas policy that has copy, plus the wallet card', () => {
    const withChains = ONBOARDING_FEATURES.filter((f) => f.chains.length > 0)
    const crossChain = ONBOARDING_FEATURES.filter((f) => f.chains.length === 0)
    expect(crossChain).toHaveLength(1)
    expect(crossChain[0].id).toBe('any-wallet')
    for (const feature of withChains) {
      expect(ACTIVE_GAS_POLICIES).toContain(feature.chains[0].gasPolicy)
    }
  })

  it('gives every card a unique id, title, body and fact', () => {
    const ids = ONBOARDING_FEATURES.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const f of ONBOARDING_FEATURES) {
      expect(f.title).not.toBe('')
      expect(f.body).not.toBe('')
      expect(f.fact).not.toBe('')
    }
  })

  /** Every chain on a card must be one the card's policy actually covers. */
  it('puts each chain on the card for its own gas policy', () => {
    for (const feature of ONBOARDING_FEATURES) {
      if (feature.chains.length === 0) continue
      const policy = feature.chains[0].gasPolicy
      expect(feature.chains).toEqual(chainsByGasPolicy(policy))
    }
  })

  it('names every covered chain in its own card body', () => {
    for (const feature of ONBOARDING_FEATURES) {
      for (const chain of feature.chains) {
        expect(feature.body).toContain(chain.name)
      }
    }
  })

  it('orders live rails before roadmap ones', () => {
    const lastLive = ONBOARDING_FEATURES.map((f) => f.status).lastIndexOf('live')
    const firstRoadmap = ONBOARDING_FEATURES.findIndex((f) => f.status === 'roadmap')
    if (firstRoadmap !== -1) expect(firstRoadmap).toBeGreaterThan(lastLive)
  })

  /**
   * A roadmap card must not read as available. This is the specific regression:
   * "Sponsored transactions through Base Paymaster are in the works" claimed a
   * mechanism whose server build path the mobile client rejects outright.
   */
  it('marks the paymaster rail as roadmap and never as shipped', () => {
    const paymasterChains = chainsByGasPolicy('paymaster')
    if (paymasterChains.length === 0) return
    const card = ONBOARDING_FEATURES.find((f) => f.chains.some((c) => c.gasPolicy === 'paymaster'))
    expect(card?.status).toBe('roadmap')
    expect(card?.fact.toLowerCase()).toContain('roadmap')
  })

  /** No card may name a chain the manifest does not ship. */
  it('never names a chain outside the shipped set', () => {
    const shipped = LANDING_CHAINS.map((c) => c.name)
    for (const feature of ONBOARDING_FEATURES) {
      for (const chain of feature.chains) expect(shipped).toContain(chain.name)
    }
  })
})

describe('feature guards', () => {
  /**
   * `none` means the user simply pays their own gas. There is no onboarding
   * story to tell, so the card must be ABSENT rather than apologetic — and no
   * chain currently uses the policy, so this path is unreachable through the
   * live manifest and untested unless called directly.
   */
  it('produces no card for a policy with no copy', () => {
    expect(featureFor('none')).toBeNull()
  })

  it('produces a card for every policy a shipped chain actually uses', () => {
    for (const policy of ['native-seed', 'feeCurrency', 'paymaster'] as const) {
      expect(featureFor(policy)).not.toBeNull()
    }
  })
})

describe('gas-free start sentence', () => {
  it('skips a policy with no gas-free clause', () => {
    expect(gasFreeSentence(['none'])).toBe('.')
  })

  it('skips a roadmap rail even though it has card copy', () => {
    expect(gasFreeSentence(['paymaster'])).toBe('.')
  })

  it('includes a live rail when asked for it alone', () => {
    expect(gasFreeSentence(['feeCurrency'])).toContain('USDC')
  })

  it('describes only live rails, never a roadmap one', () => {
    const roadmapChains = ONBOARDING_FEATURES.filter((f) => f.status === 'roadmap').flatMap(
      (f) => f.chains,
    )
    for (const chain of roadmapChains) {
      expect(GAS_FREE_START_SENTENCE).not.toContain(chain.name)
    }
  })

  it('names every chain whose gas policy makes starting free', () => {
    for (const policy of ['native-seed', 'feeCurrency'] as const) {
      for (const chain of chainsByGasPolicy(policy)) {
        expect(GAS_FREE_START_SENTENCE).toContain(chain.name)
      }
    }
  })

  it('reads as a finished sentence', () => {
    expect(GAS_FREE_START_SENTENCE).toMatch(/\.$/)
    expect(GAS_FREE_START_SENTENCE).not.toContain('undefined')
  })
})
