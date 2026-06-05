/**
 * Admin-dashboard login helpers (#84–#87).
 *
 * INVARIANT (schema/identity.ts admin_users doc-comment): admin_users is
 * the LOGIN REGISTRY only — granting an email here never grants authority;
 * users.role through ROLE_PERMISSIONS stays the single truth, and the
 * OTP-verify route re-checks role + status at verify time.
 */

import { eq } from 'drizzle-orm'
import { admin_users, users } from '@tenda/shared/db/schema/identity'
import { ADMIN_ROLES, ErrorCode } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { isPostgresUniqueViolation } from '@server/lib/db'
import { isUuidLike } from '@server/lib/escrow-routes'
import type { AppDatabase } from '@server/plugins/db'

export const ADMIN_EMAIL_MAX_LENGTH = 255

// Shape check only (catches typos, not RFC corner cases) — deliverability
// is proven by the OTP round-trip itself.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Lowercase + trim; null when the shape is invalid (write sites MUST use this). */
export function normalizeAdminEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase()
  if (email.length === 0 || email.length > ADMIN_EMAIL_MAX_LENGTH) return null
  return EMAIL_SHAPE.test(email) ? email : null
}

/**
 * Attach (or rotate) the dashboard login email for an EXISTING admin.
 * Grants LOGIN only — never touches users.role; promotion is
 * PATCH /v1/admin/users/:id/role. Callers: the ops bootstrap script
 * (#85, added_by = null) and the super_admin provisioning surface (#87,
 * added_by = acting admin).
 */
export async function grantAdminEmail(
  db: AppDatabase,
  args: { user_id: string; email: string; added_by: string | null },
): Promise<{ user_id: string; email: string; role: string }> {
  if (!isUuidLike(args.user_id)) {
    throw new AppError(422, ErrorCode.VALIDATION_ERROR, 'user_id must be a UUID')
  }
  const email = normalizeAdminEmail(args.email)
  if (email === null) {
    throw new AppError(422, ErrorCode.VALIDATION_ERROR, 'invalid email address')
  }

  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, args.user_id))
    .limit(1)
  if (user === undefined) {
    throw new AppError(404, ErrorCode.USER_NOT_FOUND, 'User not found')
  }
  if (!ADMIN_ROLES.includes(user.role as (typeof ADMIN_ROLES)[number])) {
    throw new AppError(
      422,
      ErrorCode.VALIDATION_ERROR,
      `user role is '${user.role}' — login email requires an existing admin; promote via PATCH /v1/admin/users/:id/role first`,
    )
  }

  try {
    await db
      .insert(admin_users)
      .values({ user_id: args.user_id, email, added_by: args.added_by })
      .onConflictDoUpdate({
        target: admin_users.user_id,
        set: { email, added_by: args.added_by },
      })
  } catch (err) {
    // The user_id conflict is handled above — reaching here means the
    // EMAIL unique constraint: another admin already logs in with it.
    if (isPostgresUniqueViolation(err)) {
      throw new AppError(409, ErrorCode.EMAIL_IN_USE, 'email already assigned to another admin')
    }
    throw err
  }
  return { user_id: args.user_id, email, role: user.role }
}
