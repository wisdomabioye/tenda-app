/**
 * Stage 9 auth orchestrator — turns a strategy `VerifyOutcome` into a user,
 * applying the locked policy:
 *   - block-on-collision (decision #4): linking an identity owned by another
 *     account throws IDENTITY_ALREADY_LINKED; never auto-merge.
 *   - cross-method email dedup (decision #5): a verified email maps to exactly
 *     one user, regardless of which method verified it.
 *   - wallet signs in but never creates (decision #3): find-or-reject.
 * Identity = login credential only; `users.role` still governs all access.
 */

import { and, eq } from 'drizzle-orm'
import { users, user_identities } from '@tenda/shared/db/schema'
import type { ChainNamespace } from '@tenda/shared/db/schema'
import type { User } from '@tenda/shared'
import { ErrorCode } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import {
  resolveUserByIdentity,
  resolveUserByWallet,
  findUserByVerifiedEmail,
} from '@server/lib/auth/resolver'
import type { VerifiedIdentity, VerifyOutcome } from '@server/lib/auth/strategy'
import type { AppDatabase } from '@server/plugins/db'

/** Profile fields captured at first sign-in; applied ONLY on user create. */
export interface UserBootstrap {
  is_seeker?: boolean
  country?: string | null
}

export interface AuthResolution {
  user: User
  isNew: boolean
}

/**
 * Resolve (login), link, or create a user from a verified outcome.
 * `bearerUserId` non-null = an authenticated LINK; null = login/create.
 */
export async function resolveOrLink(
  db: AppDatabase,
  outcome: VerifyOutcome,
  bearerUserId: string | null,
  bootstrap: UserBootstrap = {},
): Promise<AuthResolution> {
  return outcome.type === 'wallet'
    ? resolveWalletLogin(db, outcome.chain_ns, outcome.address)
    : resolveIdentity(db, outcome.identity, bearerUserId, bootstrap)
}

/** Wallet: login-only. An unlinked wallet is rejected (never creates an account). */
async function resolveWalletLogin(
  db: AppDatabase,
  chain_ns: ChainNamespace,
  address: string,
): Promise<AuthResolution> {
  const userId = await resolveUserByWallet(db, { chain_ns, address })
  if (userId === null) {
    throw new AppError(
      404,
      ErrorCode.WALLET_NOT_LINKED,
      'this wallet is not linked to an account — sign in or get started with phone, email, Google, or Apple, then link it',
    )
  }
  return { user: await loadUser(db, userId), isNew: false }
}

async function resolveIdentity(
  db: AppDatabase,
  identity: VerifiedIdentity,
  bearerUserId: string | null,
  bootstrap: UserBootstrap,
): Promise<AuthResolution> {
  const existingOwner = await resolveUserByIdentity(db, {
    kind: identity.kind,
    identifier: identity.identifier,
  })
  const emailOwner =
    identity.email !== null ? await findUserByVerifiedEmail(db, identity.email) : null

  if (bearerUserId !== null) {
    // LINK to the authenticated user. Block if the identity OR its verified
    // email already belongs to a different account.
    assertNotOwnedByAnother(existingOwner, bearerUserId)
    assertNotOwnedByAnother(emailOwner, bearerUserId)
    if (existingOwner === bearerUserId) {
      await markIdentityVerified(db, identity, bearerUserId)
    } else {
      await insertIdentity(db, identity, bearerUserId)
    }
    return { user: await loadUser(db, bearerUserId), isNew: false }
  }

  // LOGIN / CREATE.
  if (existingOwner !== null) return { user: await loadUser(db, existingOwner), isNew: false }
  if (emailOwner !== null) {
    // Same verified email under a new method → attach to that user (dedup, not merge).
    await insertIdentity(db, identity, emailOwner)
    return { user: await loadUser(db, emailOwner), isNew: false }
  }
  return createUserWithIdentity(db, identity, bootstrap)
}

function assertNotOwnedByAnother(ownerId: string | null, selfId: string): void {
  if (ownerId !== null && ownerId !== selfId) {
    throw new AppError(
      409,
      ErrorCode.IDENTITY_ALREADY_LINKED,
      'this identity is already linked to another account',
    )
  }
}

async function insertIdentity(
  db: AppDatabase,
  identity: VerifiedIdentity,
  userId: string,
): Promise<void> {
  const inserted = await db
    .insert(user_identities)
    .values({
      user_id: userId,
      kind: identity.kind,
      identifier: identity.identifier,
      email: identity.email,
      verified_at: new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: user_identities.id })
  if (inserted.length === 0) {
    // Lost the (kind, identifier) race — re-resolve and block if it landed elsewhere.
    const owner = await resolveUserByIdentity(db, {
      kind: identity.kind,
      identifier: identity.identifier,
    })
    assertNotOwnedByAnother(owner, userId)
  }
}

async function markIdentityVerified(
  db: AppDatabase,
  identity: VerifiedIdentity,
  userId: string,
): Promise<void> {
  await db
    .update(user_identities)
    .set({ verified_at: new Date(), email: identity.email })
    .where(
      and(
        eq(user_identities.user_id, userId),
        eq(user_identities.kind, identity.kind),
        eq(user_identities.identifier, identity.identifier),
      ),
    )
}

async function createUserWithIdentity(
  db: AppDatabase,
  identity: VerifiedIdentity,
  bootstrap: UserBootstrap,
): Promise<AuthResolution> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({ is_seeker: bootstrap.is_seeker ?? false, country: bootstrap.country ?? null })
      .returning()
    if (created === undefined) {
      throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'user insert returned no row')
    }
    const inserted = await tx
      .insert(user_identities)
      .values({
        user_id: created.id,
        kind: identity.kind,
        identifier: identity.identifier,
        email: identity.email,
        verified_at: new Date(),
      })
      .onConflictDoNothing()
      .returning({ user_id: user_identities.user_id })

    if (inserted.length > 0) return { user: created, isNew: true }

    // Concurrent first-login created the same identity — roll back our orphan
    // user (net-zero) and log in as the race winner instead.
    await tx.delete(users).where(eq(users.id, created.id))
    const winner = await tx
      .select({ user_id: user_identities.user_id })
      .from(user_identities)
      .where(
        and(
          eq(user_identities.kind, identity.kind),
          eq(user_identities.identifier, identity.identifier),
        ),
      )
      .limit(1)
    const winnerId = winner[0]?.user_id
    if (winnerId === undefined) {
      throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'identity race winner not found')
    }
    const [winnerUser] = await tx.select().from(users).where(eq(users.id, winnerId)).limit(1)
    if (winnerUser === undefined) {
      throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'identity race winner has no user row')
    }
    return { user: winnerUser, isNew: false }
  })
}

async function loadUser(db: AppDatabase, userId: string): Promise<User> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (user === undefined) {
    throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'resolved user row missing')
  }
  return user
}
