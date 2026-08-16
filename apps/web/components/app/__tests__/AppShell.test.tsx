import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Aliased: this is the SETUP MOCK's accessor, not a hook call.
import { useRouter as routerMockAccessor } from 'next/navigation'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/client', () => ({
  api: { auth: { verify: vi.fn(), me: vi.fn(), methods: vi.fn() }, users: {} },
}))

// The shell mounts useRealtimeConnection; unmocked, the REAL client would
// read the seeded JWT and jsdom's WebSocket would dial the network from a
// unit test. Mocked at the ws seam, the lifecycle wiring stays observable.
vi.mock('@/lib/ws', () => ({
  ws: { connect: vi.fn(), disconnect: vi.fn() },
}))

import { AppShell } from '@/components/app/AppShell'
import { ws } from '@/lib/ws'
import { useAuthStore } from '@/stores/auth.store'
import { JWT_TOKEN_KEY } from '@/lib/storage'
import { makeUser } from '../../../test/factories/user'

const router = vi.mocked(routerMockAccessor())

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  useAuthStore.setState({
    user: makeUser(),
    jwt: 'jwt-1',
    isAuthenticated: true,
    isLoading: false,
    profileComplete: true,
    identities: [],
  })
})

describe('AppShell', () => {
  it('mounts the realtime lifecycle: connect on authed render, teardown on unmount', () => {
    const { unmount } = render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    )
    expect(ws.connect).toHaveBeenCalled()
    unmount()
    expect(ws.disconnect).toHaveBeenCalled()
  })

  it('renders the primary nav and the signed-in user', () => {
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    )
    for (const label of ['Home', 'My Gigs', 'Messages', 'Wallet']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(screen.getByRole('link', { name: 'Ada Okafor' })).toBeInTheDocument()
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('sign out clears the session and leaves for the public feed', async () => {
    window.localStorage.setItem(JWT_TOKEN_KEY, 'jwt-1')
    render(
      <AppShell>
        <p>content</p>
      </AppShell>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(window.localStorage.getItem(JWT_TOKEN_KEY)).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(router.replace).toHaveBeenCalledWith('/gigs')
  })
})
