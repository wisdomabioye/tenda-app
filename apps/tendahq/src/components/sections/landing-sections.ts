import type { ComponentType } from 'react'
import type { LandingSectionProps, SectionSurface } from '@/components/ui/SectionShell'
import { Hero } from './hero/Hero'
import { AgentFlow } from './agent-flow'
import { TaskWall } from './task-wall/TaskWall'
import { TwoProducts } from './two-products/TwoProducts'
import { HowEscrowWorks } from './how-escrow-works/HowEscrowWorks'
import { Onboarding } from './onboarding/Onboarding'
import { Ecosystems } from './ecosystems/Ecosystems'
import { Networks } from './networks/Networks'
import { FAQ } from './faq/FAQ'
import { FinalCTA } from './final-cta/FinalCTA'

export interface LandingSectionEntry {
  /**
   * Stable identity: the React key, and the name a failing rhythm test prints.
   * Explicit rather than `Section.name`, which a production build mangles.
   */
  key: string
  Section: ComponentType<LandingSectionProps>
}

/**
 * The landing spine, in render order. This array IS the page — `LandingPage`
 * renders nothing but a map over it — so the order cannot drift from a copy of
 * itself, and inserting a section is one line here.
 *
 * Two placements are deliberate and should survive a reshuffle:
 *
 * The hire loop sits DIRECTLY under the hero, not late in the page: it is the
 * clearest statement of what Tenda does, and it was the thing a visitor had to
 * scroll past nine screens to find.
 *
 * Networks follows Ecosystems because Ecosystems argues WHY these chains, so
 * the reference table answering WHAT exactly am I connecting to reads as the
 * follow-up to that argument rather than as a spec sheet dropped between two
 * pitches.
 */
export const LANDING_SECTIONS: LandingSectionEntry[] = [
  { key: 'hero', Section: Hero },
  { key: 'hire-loop', Section: AgentFlow },
  { key: 'tasks', Section: TaskWall },
  { key: 'products', Section: TwoProducts },
  { key: 'how-it-works', Section: HowEscrowWorks },
  { key: 'onboarding', Section: Onboarding },
  { key: 'ecosystems', Section: Ecosystems },
  { key: 'networks', Section: Networks },
  { key: 'faq', Section: FAQ },
  { key: 'download', Section: FinalCTA },
]

/**
 * The page rhythm: surfaces strictly alternate from the top, so the boundary
 * between any two sections is always visible.
 *
 * This is derived from POSITION on purpose (#55). Each section used to name its
 * own surface, which put a fact about the page inside ten components that
 * cannot see the page — and made an insertion expensive rather than free, since
 * inserting into an alternating chain flips everything below it. Adding
 * Networks cost two such flips; adding the hire loop at the top cost all eight
 * sections below it, eight files that changed in no other way.
 */
export function sectionSurface(index: number): SectionSurface {
  return index % 2 === 0 ? 'base' : 'alt'
}
