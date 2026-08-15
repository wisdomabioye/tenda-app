import type { MeUser, User } from '@tenda/shared'
import { makeUser } from '../../test/factories/user'

/**
 * Deterministic auth world for e2e. One always-valid code; two personas:
 * an EXISTING user with a complete profile, and any other email creates a
 * FRESH user with empty names (→ onboarding). Mutable on purpose — the
 * profile step PATCHes names and later assertions must see them.
 */
export const E2E_OTP_CODE = '123456'
export const EXISTING_EMAIL = 'ada@tenda.test'

interface AuthWorld {
  usersByToken: Map<string, User>
  nextId: number
}

export function createAuthWorld(): AuthWorld {
  return { usersByToken: new Map(), nextId: 1 }
}

export function signIn(world: AuthWorld, identifier: string): { token: string; user: User; is_new: boolean } {
  const existing = identifier === EXISTING_EMAIL
  const user = existing
    ? makeUser({ id: 'user-existing', first_name: 'Ada', last_name: 'Okafor' })
    : makeUser({ id: `user-fresh-${world.nextId++}`, first_name: '', last_name: '' })
  const token = `e2e-jwt-${user.id}`
  world.usersByToken.set(token, user)
  return { token, user, is_new: !existing }
}

export function userForBearer(world: AuthWorld, authorization: string | undefined): User | null {
  if (authorization === undefined || !authorization.startsWith('Bearer ')) return null
  return world.usersByToken.get(authorization.slice('Bearer '.length)) ?? null
}

/** The wire projection PATCH/GET /v1/users/me serves (ISO dates, no wallet). */
export function toMeUser(user: User): MeUser {
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    bio: user.bio,
    avatar_url: user.avatar_url,
    country: user.country,
    city: user.city,
    phone_verified_at: null,
    role: user.role,
    is_seeker: user.is_seeker,
    advanced_mode_enabled: user.advanced_mode_enabled,
    created_at: user.created_at.toISOString(),
  }
}
