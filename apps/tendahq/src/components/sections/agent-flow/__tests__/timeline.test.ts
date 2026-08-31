import { describe, expect, it } from 'vitest'
import { FLOW_LANES, laneAt } from '@/content/agent-flow'
import { advance, laneDuration, stepAt } from '../useFlowTimeline'
import { fundStepOf, geometryFor } from '../circuit-paint'

/**
 * The sequencing, tested where it is decidable. This project installs no React
 * test renderer (hooks/__tests__/usePlatformConfig.test.ts tests `toPercent`
 * rather than the hook around it), so every decision the timeline makes lives
 * in a pure function and is checked here.
 */
const [HUMAN, AGENT] = FLOW_LANES

describe('stepAt', () => {
  it('reports the first step at the start of a lane', () => {
    expect(stepAt(HUMAN, 0)).toEqual({ index: 0, progress: 0 })
  })

  it('walks every step in order across a whole lane', () => {
    const seen = new Set<number>()
    const duration = laneDuration(HUMAN)
    for (let ms = 0; ms < duration; ms += 25) seen.add(stepAt(HUMAN, ms).index)
    expect(seen.size).toBe(HUMAN.steps.length)
  })

  it('holds the last frame past the end rather than wrapping itself', () => {
    // Wrapping is `advance`'s job, because that is where the LANE changes.
    // If this wrapped too, a lane would restart without ever handing over.
    const past = stepAt(HUMAN, laneDuration(HUMAN) + 5000)
    expect(past).toEqual({ index: HUMAN.steps.length - 1, progress: 1 })
  })

  it('never reports progress outside 0..1', () => {
    const duration = laneDuration(AGENT)
    for (let ms = 0; ms <= duration; ms += 37) {
      const { progress } = stepAt(AGENT, ms)
      expect(progress).toBeGreaterThanOrEqual(0)
      expect(progress).toBeLessThanOrEqual(1)
    }
  })
})

describe('advance', () => {
  it('moves the clock without changing lane mid-run', () => {
    expect(advance({ clock: 0, cursor: 0, deltaMs: 16, pinned: false })).toEqual({ clock: 16, cursor: 0 })
  })

  it('hands over to the NEXT lane when one finishes', () => {
    // The behaviour the whole section rests on: a visitor who does not click
    // still sees both lanes.
    const end = laneDuration(laneAt(0))
    const next = advance({ clock: end - 1, cursor: 0, deltaMs: 16, pinned: false })
    expect(next.cursor).toBe(1)
    expect(laneAt(next.cursor).id).not.toBe(laneAt(0).id)
  })

  it('carries the overshoot, so a slow frame cannot swallow the next lane’s first step', () => {
    const end = laneDuration(laneAt(0))
    const { clock } = advance({ clock: end - 4, cursor: 0, deltaMs: 20, pinned: false })
    expect(clock).toBe(16)
  })

  it('repeats the same lane while pinned, instead of handing over', () => {
    const end = laneDuration(laneAt(0))
    const next = advance({ clock: end - 1, cursor: 0, deltaMs: 16, pinned: true })
    expect(next.cursor).toBe(0)
    expect(next.clock).toBeLessThan(end)
  })

  it('cycles back round rather than running off the end of the lane list', () => {
    const last = FLOW_LANES.length - 1
    const end = laneDuration(laneAt(last))
    const next = advance({ clock: end, cursor: last, deltaMs: 16, pinned: false })
    expect(laneAt(next.cursor).id).toBe(FLOW_LANES[0].id)
  })

  it('does not produce a NaN clock when a delta exceeds a whole lane', () => {
    // A backgrounded tab resuming, or a debugger pause. The modulo is what
    // stops that becoming a blank circuit.
    const { clock } = advance({ clock: 0, cursor: 0, deltaMs: laneDuration(laneAt(0)) * 3 + 7, pinned: false })
    expect(Number.isFinite(clock)).toBe(true)
    expect(clock).toBeGreaterThanOrEqual(0)
  })
})

describe('circuit geometry', () => {
  it('stacks below the breakpoint and spans above it', () => {
    // A left-to-right circuit on a phone is an unreadable smear, so the narrow
    // layout is a different arrangement rather than a shrunk copy.
    expect(geometryFor(390).stacked).toBe(true)
    expect(geometryFor(1100).stacked).toBe(false)
  })

  it('actually moves the actors, rather than only setting a flag', () => {
    const narrow = geometryFor(390)
    const wide = geometryFor(1100)
    expect(narrow.left).not.toEqual(wide.left)
    expect(narrow.right).not.toEqual(wide.right)
  })

  it('keeps every node inside the canvas in both arrangements', () => {
    for (const width of [360, 620, 1280]) {
      const g = geometryFor(width)
      for (const point of [g.left, g.right, g.vault, g.feed]) {
        expect(point.x).toBeGreaterThan(0)
        expect(point.x).toBeLessThan(1)
        expect(point.y).toBeGreaterThan(0)
        expect(point.y).toBeLessThan(1)
      }
    }
  })

  it('knows which step funds the escrow in each lane', () => {
    // The human signs and broadcasts on step 1; the agent's relayed funding is
    // step 2, because it spends a step on the x402 signature first. Getting
    // this wrong fills the vault before the money moves.
    expect(fundStepOf(HUMAN)).toBe(1)
    expect(fundStepOf(AGENT)).toBe(2)
    expect(HUMAN.steps[fundStepOf(HUMAN)].gas).toBe('poster pays')
    expect(AGENT.steps[fundStepOf(AGENT)].gas).toBe('relayer pays')
  })
})
