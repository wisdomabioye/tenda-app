import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { AGENT_BADGE_LABEL } from '@tenda/shared/constants/users'
import { FEE_PCT } from '@/content/fees'
import { AGENT_COLOR, ALL_FLOW_STEPS, FLOW_LANES } from '@/content/agent-flow'
import { chainByFamily } from '@/content/chains'
import { AgentFlow } from '../AgentFlow'
import { SignalCircuit } from '../SignalCircuit'

/**
 * The section publishes its steps as CONTENT. Everything here asserts that the
 * meaning survives with the animation off — the canvas is an enhancement over a
 * readable list, never the only copy of it.
 */
// The surface is handed down by the page (#55); nothing asserted below
// depends on which one.
const html = renderToStaticMarkup(<AgentFlow surface="alt" />)
const [HUMAN] = FLOW_LANES

describe('the hire loop section', () => {
  it('renders every step of the lane on screen, not just the one being animated', () => {
    // Static markup is the first frame. A step revealed only by the timer would
    // be missing here — and missing for anyone with motion disabled.
    for (const step of HUMAN.steps) {
      expect(html).toContain(step.label)
      expect(html).toContain(step.note)
    }
  })

  it('opens on the human lane, because that is what Tenda mostly is', () => {
    // Gigs are overwhelmingly person to person; leading with the agent would
    // misrepresent the product, and the agent reveal only lands after the
    // ordinary case has been seen.
    expect(FLOW_LANES[0].id).toBe('human')
    expect(html).toContain(HUMAN.left.label)
  })

  it('says who pays for every step, and says so when nobody does', () => {
    for (const step of HUMAN.steps) {
      expect(html).toContain(step.gas ?? 'no transaction')
    }
    const free = HUMAN.steps.filter((s) => s.gas === null)
    const paid = HUMAN.steps.filter((s) => s.gas !== null)
    expect(free.length).toBeGreaterThan(0)
    expect(paid).toHaveLength(4)
  })

  it('hides the CANVAS from assistive tech, not the steps', () => {
    /*
     * Counting, not slicing. An earlier version of this check searched from the
     * list's own tag onwards for `aria-hidden` — so the attribute on an
     * ANCESTOR, which is exactly where this bug would be, sat outside the slice
     * and the test passed with the whole section silenced. Every aria-hidden in
     * the section must be one the visual introduced.
     */
    const visual = renderToStaticMarkup(
      <SignalCircuit lane={HUMAN} activeIndex={0} progress={0} />,
    )
    const count = (s: string) => s.split('aria-hidden').length - 1
    expect(count(visual)).toBe(1)
    expect(count(html)).toBe(count(visual))
    expect(html).toContain('<ol')
  })

  it('offers a way to hold a lane, and explains that it cycles', () => {
    // The control is an override, not the only route to the second lane.
    for (const l of FLOW_LANES) expect(html).toContain(l.title)
    expect(html).toContain('aria-pressed')
    expect(html.toLowerCase()).toContain('pick one to hold it')
  })

  it('quotes the badge and the fee from their sources, not from copies', () => {
    expect(ALL_FLOW_STEPS.some((s) => s.note.includes(`“${AGENT_BADGE_LABEL}”`))).toBe(true)
    expect(ALL_FLOW_STEPS.some((s) => s.note.includes(`${FEE_PCT}%`))).toBe(true)
  })

  it('takes the agent’s colour from the chain registry, not a literal', () => {
    // content/chains.ts documents itself as "the one place a per-chain hex is
    // allowed". A second copy here would drift the day 0G rebrands.
    expect(AGENT_COLOR).not.toBeNull()
    expect(AGENT_COLOR).toBe(chainByFamily('0g')?.color)
  })

  it('names no chain, so it cannot go stale at mainnet', () => {
    // The rail is a property of the API, not of a deployment. Naming a chain
    // would make this copy answerable to chain-status.ts for no gain.
    for (const name of ['0G', 'Solana', 'Base', 'Celo']) {
      expect(ALL_FLOW_STEPS.every((s) => !s.label.includes(name))).toBe(true)
    }
  })
})

describe('both lanes describe the same machine with different entrances', () => {
  it('agree on step count and on how many transactions there are', () => {
    const onchain = (l: (typeof FLOW_LANES)[number]) => l.steps.filter((s) => s.gas !== null).length
    const [first] = FLOW_LANES
    for (const l of FLOW_LANES) {
      expect(l.steps).toHaveLength(first.steps.length)
      expect(onchain(l)).toBe(onchain(first))
    }
  })

  it('differ exactly where the argument is — who pays to get in', () => {
    // The section's whole claim in one assertion. A person signs AND
    // broadcasts and pays for it; an agent signs only and someone else pays.
    const [human, agent] = FLOW_LANES
    expect(human.steps[1].gas).toBe('poster pays')
    expect(agent.steps[2].gas).toBe('relayer pays')
    expect(agent.steps.filter((s) => s.gas === null)).toHaveLength(2)
    expect(human.steps.filter((s) => s.gas === null)).toHaveLength(2)
  })

  it('converge completely once the money is locked', () => {
    const [human, agent] = FLOW_LANES
    expect(human.steps.slice(3).map((s) => s.gas)).toEqual(
      agent.steps.slice(3).map((s) => s.gas).map((g) => (g === 'agent pays' ? 'poster pays' : g)),
    )
  })

  it('records the assignment fork, and that it inverts who pays', () => {
    // POST /v1/escrows/:id/assign: "the transition where the WORKER signs
    // nothing" — the poster signs that accept and pays for it. Dropping this
    // would make the human lane simpler than the product.
    const matched = HUMAN.steps.find((s) => s.id === 'h-match')
    const accept = HUMAN.steps.find((s) => s.id === 'h-accept')
    expect(matched?.note).toContain('open feed')
    expect(matched?.note).toContain('assigned')
    expect(accept?.note).toContain('worker signs nothing')
  })
})

describe('the visual is replaceable, which is the point of the split', () => {
  const dir = join(__dirname, '..')

  it('is imported by exactly one file — the section', () => {
    // The requirement in one assertion: swapping treatments must be a single
    // import change. A second importer anywhere makes that false silently.
    const importers = readdirSync(dir)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
      .filter((f) => readFileSync(join(dir, f), 'utf8').includes("from './SignalCircuit'"))
    expect(importers).toEqual(['AgentFlow.tsx'])
  })

  it('renders from its props alone, so a replacement needs no other wiring', () => {
    expect(() =>
      renderToStaticMarkup(<SignalCircuit lane={FLOW_LANES[1]} activeIndex={5} progress={1} />),
    ).not.toThrow()
  })
})
