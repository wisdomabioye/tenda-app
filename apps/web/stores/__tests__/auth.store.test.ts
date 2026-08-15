/**
 * Web session core — the semantics ported from mobile must hold: stale-bearer
 * purge on 401 UNAUTHORIZED, bootstrap that clears on 401/403 but KEEPS the
 * credential on transient failures, logout that leaves no bearer behind, and
 * the cross-tab storage-event sync (stage-2 DoD).
 */
import { vi } from 'vitest'

vi.mock('@/api/client', () => ({
  api: { auth: { verify: vi.fn(), me: vi.fn(), methods: vi.fn() }, users: { updateMe: vi.fn() } },
}))

import { ApiClientError } from '@tenda/shared'
import { api } from '@/api/client'
import { initCrossTabAuthSync, useAuthStore } from '@/stores/auth.store'
import { JWT_TOKEN_KEY } from '@/lib/storage'
import { makeUser } from '../../test/factories/user'

const authApi = vi.mocked(api.auth)

function resetStore() {
  window.localStorage.clear()
  useAuthStore.setState({
    user: null,
    jwt: null,
    isAuthenticated: false,
    isLoading: true,
    profileComplete: null,
    identities: [],
  })
}

beforeEach(resetStore)

describe('signInWithVerify', () => {
  it('stores the token, hydrates the user, and derives profileComplete', async () => {
    const user = makeUser({ first_name: 'Ada', last_name: 'Okafor' })
    authApi.verify.mockResolvedValue({ token: 'jwt-1', user, is_new: false })

    const result = await useAuthStore.getState().signInWithVerify({
      method: 'email',
      identifier: 'ada@x.io',
      code: '123456',
    })

    expect(result).toEqual({ isNew: false })
    expect(window.localStorage.getItem(JWT_TOKEN_KEY)).toBe('jwt-1')
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.profileComplete).toBe(true)
  })

  it('a fresh account with empty names is profile-incomplete', async () => {
    authApi.verify.mockResolvedValue({
      token: 'jwt-new',
      user: makeUser({ first_name: '', last_name: '' }),
      is_new: true,
    })
    const result = await useAuthStore.getState().signInWithVerify({
      method: 'email',
      identifier: 'new@x.io',
      code: '123456',
    })
    expect(result.isNew).toBe(true)
    expect(useAuthStore.getState().profileComplete).toBe(false)
  })

  it("purges a stale bearer when the JWT guard 401s, so the next attempt starts clean", async () => {
    window.localStorage.setItem(JWT_TOKEN_KEY, 'stale-jwt')
    authApi.verify.mockRejectedValue(new ApiClientError(401, 'Unauthorized', 'Invalid or missing token', 'UNAUTHORIZED'))

    await expect(
      useAuthStore.getState().signInWithVerify({ method: 'email', identifier: 'a@x.io', code: '000000' }),
    ).rejects.toBeInstanceOf(ApiClientError)

    expect(window.localStorage.getItem(JWT_TOKEN_KEY)).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('does NOT purge on an ordinary verify failure (wrong code)', async () => {
    window.localStorage.setItem(JWT_TOKEN_KEY, 'still-valid')
    authApi.verify.mockRejectedValue(new ApiClientError(401, 'Unauthorized', 'Invalid or expired code', 'OTP_INVALID'))

    await expect(
      useAuthStore.getState().signInWithVerify({ method: 'email', identifier: 'a@x.io', code: '999999' }),
    ).rejects.toBeInstanceOf(ApiClientError)

    expect(window.localStorage.getItem(JWT_TOKEN_KEY)).toBe('still-valid')
  })
})

describe('loadSession', () => {
  it('no stored token → signed out, done loading, no network call', async () => {
    await useAuthStore.getState().loadSession()
    const state = useAuthStore.getState()
    expect(state.isLoading).toBe(false)
    expect(state.isAuthenticated).toBe(false)
    expect(authApi.me).not.toHaveBeenCalled()
  })

  it('valid token → hydrates from me() with profileComplete', async () => {
    window.localStorage.setItem(JWT_TOKEN_KEY, 'jwt-ok')
    authApi.me.mockResolvedValue(makeUser())
    await useAuthStore.getState().loadSession()
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.jwt).toBe('jwt-ok')
    expect(state.profileComplete).toBe(true)
  })

  it('401 → clears storage and signs out', async () => {
    window.localStorage.setItem(JWT_TOKEN_KEY, 'dead-jwt')
    authApi.me.mockRejectedValue(new ApiClientError(401, 'Unauthorized', 'invalid', 'UNAUTHORIZED'))
    await useAuthStore.getState().loadSession()
    expect(window.localStorage.getItem(JWT_TOKEN_KEY)).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('transient failure → KEEPS the stored credential but routes signed out', async () => {
    window.localStorage.setItem(JWT_TOKEN_KEY, 'jwt-keep')
    authApi.me.mockRejectedValue(new TypeError('Network request failed'))
    await useAuthStore.getState().loadSession()
    const state = useAuthStore.getState()
    expect(window.localStorage.getItem(JWT_TOKEN_KEY)).toBe('jwt-keep')
    expect(state.jwt).toBe('jwt-keep')
    expect(state.isAuthenticated).toBe(false)
    expect(state.isLoading).toBe(false)
  })
})

describe('logout', () => {
  it('clears state and storage so no stale bearer reaches the next challenge', async () => {
    window.localStorage.setItem(JWT_TOKEN_KEY, 'jwt-1')
    useAuthStore.setState({ user: makeUser(), jwt: 'jwt-1', isAuthenticated: true, isLoading: false })
    await useAuthStore.getState().logout()
    expect(window.localStorage.getItem(JWT_TOKEN_KEY)).toBeNull()
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })
})

describe('linkIdentity + loadMethods', () => {
  it('links with link:true and refreshes the methods list', async () => {
    authApi.verify.mockResolvedValue({ token: 'discarded', user: makeUser(), is_new: false })
    authApi.methods.mockResolvedValue({
      identities: [{ kind: 'email', identifier: 'ada@x.io', email: 'ada@x.io', verified: true }],
    })
    authApi.me.mockResolvedValue(makeUser())

    await useAuthStore.getState().linkIdentity({ method: 'email', identifier: 'ada@x.io', code: '123456' })

    expect(authApi.verify).toHaveBeenCalledWith(
      { method: 'email', identifier: 'ada@x.io', code: '123456' },
      { link: true },
    )
    expect(useAuthStore.getState().identities).toHaveLength(1)
  })

  it('a methods failure is non-fatal', async () => {
    authApi.methods.mockRejectedValue(new Error('down'))
    await expect(useAuthStore.getState().loadMethods()).resolves.toBeUndefined()
  })
})

describe('cross-tab sync', () => {
  it('token removed in another tab → this tab signs out', () => {
    useAuthStore.setState({ user: makeUser(), jwt: 'jwt-1', isAuthenticated: true, isLoading: false })
    const cleanup = initCrossTabAuthSync()
    window.dispatchEvent(new StorageEvent('storage', { key: JWT_TOKEN_KEY, newValue: null }))
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    cleanup()
  })

  it('token appeared in another tab → this tab re-runs the bootstrap', async () => {
    window.localStorage.setItem(JWT_TOKEN_KEY, 'jwt-2')
    authApi.me.mockResolvedValue(makeUser())
    const cleanup = initCrossTabAuthSync()
    window.dispatchEvent(new StorageEvent('storage', { key: JWT_TOKEN_KEY, newValue: 'jwt-2' }))
    await vi.waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(true))
    cleanup()
  })

  it('ignores unrelated storage keys', () => {
    useAuthStore.setState({ isAuthenticated: true, isLoading: false })
    const cleanup = initCrossTabAuthSync()
    window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: 'dark' }))
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    cleanup()
  })

  it('cleanup detaches the listener', () => {
    useAuthStore.setState({ isAuthenticated: true, isLoading: false })
    const cleanup = initCrossTabAuthSync()
    cleanup()
    window.dispatchEvent(new StorageEvent('storage', { key: JWT_TOKEN_KEY, newValue: null }))
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })
})
