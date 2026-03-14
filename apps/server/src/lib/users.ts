import { eq } from 'drizzle-orm'
import { users } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'

import type { AppDatabase } from '@server/plugins/db'
import { AppError } from './errors'

/**
 * Verifies a user exists. Throws a 404 AppError if not found.
 * Selects only `id` — callers that need additional columns should query directly.
 */
export async function ensureUserExists(db: AppDatabase, id: string): Promise<{ id: string }> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
  if (!user) throw new AppError(404, ErrorCode.USER_NOT_FOUND, 'User not found')
  return user
}
