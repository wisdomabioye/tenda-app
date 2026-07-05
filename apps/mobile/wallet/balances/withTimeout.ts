/** Default per-RPC budget for a balance read. */
export const RPC_TIMEOUT_MS = 10_000

/**
 * Reject if `promise` hasn't settled within `ms`. The wallet screen awaits a
 * `Promise.allSettled` over every (wallet × chain × asset) read, and allSettled
 * only resolves once EVERY child settles, so a single hung RPC endpoint would
 * otherwise strand `isLoading` on a perpetual skeleton. Bounding each read keeps
 * one dead endpoint from wedging the screen (the timed-out read is dropped).
 */
export async function withTimeout<T>(promise: Promise<T>, ms = RPC_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`rpc timeout after ${ms}ms`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}
