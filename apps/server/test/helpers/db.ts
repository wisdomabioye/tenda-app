/**
 * Test-DB lifecycle. See README in this folder.
 *
 * Status: types-only scaffold. Concrete impl arrives during Stage 0 work-pass
 * (needs a test-DB provisioning decision: testcontainers vs. local Postgres
 * vs. a dedicated CI service).
 */

import type { TestContext } from 'node:test'

/** Opaque handle returned to the test body. Drizzle client TBD per impl. */
export interface TestDb {
  /** Reserved for the future Drizzle client; intentionally opaque for now. */
  readonly handle: unique symbol
}

/**
 * Opens a transactional connection, runs `fn`, then rolls back. Implementation
 * registers `t.after(...)` for cleanup so callers never need to.
 */
export declare function withTestDb<T>(t: TestContext, fn: (db: TestDb) => Promise<T>): Promise<T>
