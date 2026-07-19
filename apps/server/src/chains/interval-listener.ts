/**
 * Shared interval skeleton behind every polling `ChainListener`: run the
 * chain-specific tick on a fixed cadence, never overlap ticks (a slow RPC
 * round-trip must not stack), log-and-continue on tick failure, and unref the
 * timer so a draining process isn't held open. The tick owns all chain logic;
 * this owns only the clock.
 */

import type { ChainId, ChainListener } from '@server/chains/types'

export interface IntervalListenerDeps {
  chain_id: ChainId
  interval_ms: number
  tick(): Promise<unknown>
  log: {
    info(obj: Record<string, unknown>, msg: string): void
    warn(obj: Record<string, unknown>, msg: string): void
  }
}

export function createIntervalListener(deps: IntervalListenerDeps): ChainListener {
  let timer: NodeJS.Timeout | null = null
  let running = false

  return {
    async start() {
      timer = setInterval(() => {
        if (running) return // skip overlapping ticks
        running = true
        deps
          .tick()
          .catch((err) => deps.log.warn({ err, chain_id: deps.chain_id }, 'polling tick failed'))
          .finally(() => {
            running = false
          })
      }, deps.interval_ms)
      timer.unref()
      deps.log.info(
        { interval_ms: deps.interval_ms, chain_id: deps.chain_id },
        'polling listener started',
      )
    },
    async stop() {
      if (timer !== null) clearInterval(timer)
      timer = null
    },
  }
}
