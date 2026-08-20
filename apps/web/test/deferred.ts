/**
 * A promise the test resolves by hand, so "in flight" is a real state rather
 * than a race with the scheduler.
 *
 * Lives here because three suites had already written it out for themselves
 * (account-switch.inflight, chain-registry.store, and the pagination fixtures)
 * and #93 would have made a fourth. Only the new caller uses it so far;
 * migrating the other three is #94, kept separate so this file's arrival is not
 * tangled with edits to three unrelated suites.
 *
 * Not under `__tests__/`, so it sits beside `setup.tsx` and the factories —
 * ungated like both, since it is harness rather than app code.
 */
export interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: Error) => void
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
