/**
 * Sequencing for the hire-loop section: which step is lit, and which lane.
 *
 * KEPT OUT OF THE VISUAL. The diagram is expected to be replaced; timing,
 * viewport gating, lane auto-advance and reduced motion are the parts that must
 * behave identically whichever diagram is on screen. A replacement takes
 * `{ lane, activeIndex }` and renders.
 *
 * AUTO-ADVANCE, NOT A BARE TOGGLE. A landing visitor does not click, so a
 * control is the wrong way to reveal half the content: the lane flips itself
 * when the loop wraps, and a visitor who wants to stay on one pins it. That is
 * also why the section does not ship a tab rail — Onboarding sits directly
 * below and already is one.
 */
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { FLOW_LANES, laneAt, type FlowLane } from '@/content/agent-flow'

/** Total run time of a lane. */
export function laneDuration(lane: FlowLane): number {
  return lane.steps.reduce((sum, step) => sum + step.ms, 0)
}

/**
 * Which step a lane is on at `ms`, and how far through it.
 *
 * Pure, and exported because this project installs no React test renderer —
 * see hooks/__tests__/usePlatformConfig.test.ts, which tests `toPercent` rather
 * than the hook wrapping it. A decision left inside a hook body is a decision
 * nothing can check.
 */
export function stepAt(lane: FlowLane, ms: number): { index: number; progress: number } {
  let acc = 0
  for (let i = 0; i < lane.steps.length; i += 1) {
    const step = lane.steps[i]
    if (ms < acc + step.ms) return { index: i, progress: (ms - acc) / step.ms }
    acc += step.ms
  }
  // Past the end: hold the last frame rather than wrapping here. Wrapping is
  // the caller's job, because that is where the lane changes.
  return { index: lane.steps.length - 1, progress: 1 }
}

/**
 * Advance the clock, wrapping into the NEXT lane when a lane finishes.
 *
 * Returns the new clock and lane cursor. Pinning stops the cursor moving, so a
 * pinned lane repeats instead of handing over; that is the whole difference
 * between "let it play" and "I want to read this one".
 */
export function advance(args: {
  clock: number
  cursor: number
  deltaMs: number
  pinned: boolean
}): { clock: number; cursor: number } {
  const { clock, cursor, deltaMs, pinned } = args
  const duration = laneDuration(laneAt(cursor))
  const next = clock + deltaMs
  if (next < duration) return { clock: next, cursor }
  // Carry the overshoot so a slow frame does not swallow the first step of the
  // next lane; modulo guards a delta longer than a whole lane.
  return { clock: next % duration, cursor: pinned ? cursor : cursor + 1 }
}

export interface FlowTimeline {
  lane: FlowLane
  activeIndex: number
  progress: number
  /** The lane the visitor pinned, or null while it is cycling. */
  pinnedId: string | null
  /** Pin a lane, or unpin it by choosing the one already pinned. */
  togglePin(id: string): void
}

export function useFlowTimeline(args: { running: boolean }): FlowTimeline {
  const reduced = useReducedMotion()
  // ONE state object, not two. Clock and lane cursor change together, and
  // splitting them meant calling setCursor from inside the setClock updater —
  // a side effect in a reducer, which StrictMode double-invokes, advancing the
  // lane twice per wrap.
  const [{ clock, cursor }, setPosition] = useState({ clock: 0, cursor: 0 })
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const raf = useRef(0)
  const last = useRef(0)

  // `pinnedId` is a DEPENDENCY, not a ref read during render. Mirroring it into
  // a ref is the usual trick for keeping a rAF closure fresh, but writing a ref
  // while rendering is exactly what react-hooks/refs forbids — and there is no
  // need here: pinning is a click, so restarting the loop on that click costs
  // one frame and keeps the closure honest.
  useEffect(() => {
    if (reduced || !args.running) return
    const pinned = pinnedId !== null
    last.current = performance.now()
    const tick = (now: number) => {
      const deltaMs = Math.min(64, now - last.current)
      last.current = now
      setPosition((pos) => advance({ ...pos, deltaMs, pinned }))
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [reduced, args.running, pinnedId])

  const togglePin = (id: string): void => setPinnedId((current) => (current === id ? null : id))

  const pinnedLane = pinnedId === null ? null : FLOW_LANES.find((l) => l.id === pinnedId) ?? null
  const lane = pinnedLane ?? laneAt(cursor)

  // Reduced motion holds the FINISHED frame: freezing at step 0 would hide five
  // of six steps from exactly the people least able to wait for a reveal.
  if (reduced) {
    return {
      lane,
      activeIndex: lane.steps.length - 1,
      progress: 1,
      pinnedId,
      togglePin,
    }
  }

  const { index, progress } = stepAt(lane, clock)
  return { lane, activeIndex: index, progress, pinnedId, togglePin }
}
