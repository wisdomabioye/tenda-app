import type { User } from '@tenda/shared'

/**
 * Fully-typed User row for tests and the e2e stub — typed against the REAL
 * shared row type so a schema change breaks the build here, not silently in
 * a fixture that stopped matching the wire.
 */
export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-test-1',
    first_name: 'Ada',
    last_name: 'Okafor',
    bio: null,
    avatar_url: null,
    country: 'NG',
    city: 'Lagos',
    latitude: null,
    longitude: null,
    role: 'user',
    status: 'active',
    is_seeker: false,
    review_score: null,
    sponsored_tx_remaining: 3,
    advanced_mode_enabled: false,
    display_currency: null,
    announcements_read_at: null,
    last_active_at: null,
    created_at: new Date('2026-08-01T10:00:00.000Z'),
    updated_at: new Date('2026-08-01T10:00:00.000Z'),
    ...overrides,
  }
}
