/**
 * The two questions every account-scoped piece of client state has to answer,
 * in one place for both clients.
 *
 *   "Does someone empty this when the account changes?"  — registerAccountReset
 *   "Can a response already in flight write into the next account?"
 *                                                       — accountGeneration
 *
 * They are DIFFERENT questions and a module needs both. Web learned the second
 * the hard way (#45): the reset was real, and then a request that had left
 * before it landed after it and put the previous account's threads back,
 * unread badge and all.
 *
 * WHY THIS IS SHARED, not one copy per client. It is plain module state — no
 * React, no storage, no platform API — and the alternative is the same rule
 * written twice, which is the shape this repo has now removed three times
 * (#40 refresh coordinator, #42 api clients, #43 three pure duplicates). Mobile
 * needed it because signing out there is a navigation, not a process restart,
 * exactly as it is in a browser tab (#65).
 *
 * WEB HAS NOT COLLAPSED ONTO THIS YET, and that is a decision, not an
 * oversight. `apps/web/lib/account-state.ts` still holds its own copy of the
 * counter and the reset list, because its `clearAccountState` also empties a
 * dozen module-scoped list caches and is called from three places — logout, the
 * cross-tab `storage` listener, and sign-in — one of which is only covered by
 * an e2e. Folding that in here would have made #65, a mobile leak, converge on
 * a web refactor. Tracked as #74; until it lands there are two registries and
 * two counters, they cannot see each other, and a web module must keep
 * importing web's.
 *
 * The REGISTRY is here; what each client registers is not. Web registers its
 * list caches and its stores; mobile registers its stores. A cache or store
 * that is never imported holds nothing, so an unregistered-because-unloaded
 * module is not a leak.
 */

/**
 * Which account the state in memory belongs to. Bumped by every account
 * TRANSITION its client reports — not only by clears, and sign-IN counts.
 * Mobile reports both of its sign-in paths and its sign-out; a cross-tab change
 * is web's case and does not reach this counter until #74 lands.
 *
 * Emptying a store is a MOMENT; a request already on its way is not stopped by
 * it. So an async writer takes a snapshot BEFORE its await and drops the write
 * if the number has moved. That states the actual rule — "this response belongs
 * to a previous account" — where a per-store request token could only say "a
 * later request superseded it", which a sign-out is not.
 */
let generation = 0

/** Snapshot before an await. Compare with `isSameAccount` after it. */
export function accountGeneration(): number {
  return generation
}

/** Whether the account is still the one `gen` was taken under. */
export function isSameAccount(gen: number): boolean {
  return gen === generation
}

/**
 * A new account now owns the in-memory state — WITHOUT emptying anything.
 *
 * For sign-IN, where there is nothing left to clear but the generation still
 * has to move, so a request issued during the signed-out window cannot write
 * into the session that follows.
 *
 * It must not clear, and that is not a preference. Web found it with its own
 * copy of this function: its sign-in flow store is MID-USE at that moment, so
 * clearing blanked the verify card one step before the next page painted — the
 * regression #14's review had already fixed once, brought straight back by
 * calling the clear here (#45).
 */
export function beginAccountSession(): void {
  generation += 1
}

const resets: Array<() => void> = []

/**
 * Declare a module's state account-scoped. Call at module scope, next to the
 * state it protects — the point is that the place you must not forget is the
 * file you are already writing, rather than a list in some logout function
 * three directories away.
 */
export function registerAccountReset(reset: () => void): void {
  resets.push(reset)
}

/**
 * Empty everything registered, and move the generation.
 *
 * A client calls this at any transition where the state must actually GO —
 * mobile calls it from `logout` alone, because its sign-in has nothing left to
 * empty and reports itself with `beginAccountSession` instead. Which of the two
 * a transition needs is the client's decision; what is not optional is that
 * every transition calls one of them, or the signed-out window becomes a hole
 * through which a request can write into the session that follows.
 */
export function clearAccountState(): void {
  // FIRST, so a response that lands while the clearing is still running is
  // already stale to every guard that checks — the bump must not be observable
  // as "after".
  beginAccountSession()
  for (const reset of resets) reset()
}

/** Test seam: forget every registration, so one suite cannot leak into the next. */
export function resetAccountStateRegistryForTests(): void {
  resets.length = 0
}
