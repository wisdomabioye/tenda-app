import { useEffect, useState } from 'react'
import { useReducedMotion } from './useReducedMotion'

interface Options {
  /** Start animating only when this is true (e.g. on intersection). */
  active: boolean
  from?: number
  to: number
  /** Duration in ms. */
  duration?: number
}

/**
 * Animate a number from `from` to `to` over `duration` once `active` flips true.
 * Skips animation entirely if the user prefers reduced motion — returns `to` immediately.
 */
export function useCountUp({ active, from = 0, to, duration = 480 }: Options): number {
  const reduced = useReducedMotion()
  const [value, setValue] = useState(reduced || !active ? to : from)

  useEffect(() => {
    if (!active || reduced) {
      setValue(to)
      return
    }

    let raf = 0
    const start = performance.now()
    const delta = to - from

    function tick(now: number) {
      const elapsed = now - start
      const t = Math.min(1, elapsed / duration)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(from + delta * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, from, to, duration, reduced])

  return value
}
