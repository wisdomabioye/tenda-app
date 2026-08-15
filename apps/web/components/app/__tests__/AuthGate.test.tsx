import { render, screen } from '@testing-library/react'
// Aliased: this is the SETUP MOCK's accessor, not a hook call.
import { useRouter as routerMockAccessor } from 'next/navigation'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/client', () => ({
  api: { auth: { verify: vi.fn(), me: vi.fn(), methods: vi.fn() }, users: {} },
}))

import { AuthGate } from '@/components/app/AuthGate'
import { useAuthStore } from '@/stores/auth.store'

const router = vi.mocked(routerMockAccessor())

beforeEach(() => {
  window.localStorage.clear()
  useAuthStore.setState({
    user: null,
    jwt: null,
    isAuthenticated: false,
    isLoading: true,
    profileComplete: null,
    identities: [],
  })
})

describe('AuthGate', () => {
  it('shows a skeleton while the session bootstraps', () => {
    render(
      <AuthGate>
        <p>secret</p>
      </AuthGate>,
    )
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  it('redirects an unauthenticated visitor to /signin', async () => {
    useAuthStore.setState({ isLoading: false, isAuthenticated: false })
    render(
      <AuthGate>
        <p>secret</p>
      </AuthGate>,
    )
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith('/signin'))
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  it('routes an incomplete profile to onboarding', async () => {
    useAuthStore.setState({ isLoading: false, isAuthenticated: true, profileComplete: false })
    render(
      <AuthGate>
        <p>secret</p>
      </AuthGate>,
    )
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith('/onboarding/profile'))
  })

  it('renders children for a complete session', () => {
    useAuthStore.setState({ isLoading: false, isAuthenticated: true, profileComplete: true })
    render(
      <AuthGate>
        <p>secret</p>
      </AuthGate>,
    )
    expect(screen.getByText('secret')).toBeInTheDocument()
  })
})
