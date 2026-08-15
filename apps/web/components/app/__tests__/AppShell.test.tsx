import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Aliased: this is the SETUP MOCK's accessor, not a hook call.
import { useRouter as routerMockAccessor } from 'next/navigation'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/client', () => ({
  api: { auth: { verify: vi.fn(), me: vi.fn(), methods: vi.fn() }, users: {} },
}))

import { AppShell } from '@/components/app/AppShell'
import { useAuthStore } from '@/stores/auth.store'
import { JWT_TOKEN_KEY } from '@/lib/storage'
import { makeUser } from '../../../test/factories/user'

const router = vi.mocked(routerMockAccessor())

beforeEach(() => {
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
