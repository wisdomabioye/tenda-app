/**
 * The last step. What matters here is that the form's gate is the SERVER's
 * gate: a name this page accepts must be one `requireProfileComplete` accepts,
 * or the reader is bounced back with "Complete your profile" and no visible
 * cause.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { hasCompleteName } from '@tenda/shared'
import OnboardingProfilePage from '@/app/(focused)/onboarding/profile/page'
import { AUTH_COPY } from '@/components/auth/copy'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth.store'

const replace = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }))
vi.mock('@/api/client', () => ({
  api: { users: { updateMe: vi.fn() } },
}))

const authed = () =>
  useAuthStore.setState({
    isLoading: false,
    isAuthenticated: true,
    user: { id: 'u1', first_name: '', last_name: '' } as never,
    refreshUser: vi.fn(),
    setProfileComplete: vi.fn(),
    loadSession: vi.fn(),
  })

describe('OnboardingProfilePage', () => {
  beforeEach(() => {
    replace.mockClear()
    authed()
  })
  afterEach(cleanup)

  const type = (first: string, last: string) => {
    fireEvent.change(screen.getByLabelText(AUTH_COPY.profile.first), { target: { value: first } })
    fireEvent.change(screen.getByLabelText(AUTH_COPY.profile.last), { target: { value: last } })
  }

  it('gates submit on the SHARED completeness predicate, not a local rule', () => {
    render(<OnboardingProfilePage />)
    const cta = screen.getByRole('button', { name: AUTH_COPY.profile.cta })

    // The case that matters: a blank-looking surname. `filter(Boolean)` keeps
    // '  ' and every naive check calls this complete — the server does not.
    type('Segun', '   ')
    expect(hasCompleteName('Segun', '   ')).toBe(false)
    expect(cta).toBeDisabled()

    type('Segun', 'Oyelaran')
    expect(cta).toBeEnabled()
  })

  it('previews the name as the gig card will render it', () => {
    render(<OnboardingProfilePage />)
    expect(screen.getByText(AUTH_COPY.profile.previewEmpty)).toBeInTheDocument()
    type('Segun', 'Oyelaran')
    expect(screen.getByText('Segun Oyelaran')).toBeInTheDocument()
  })

  it('sends trimmed names and takes profile_complete from the SERVER', async () => {
    const setProfileComplete = vi.fn()
    useAuthStore.setState({ setProfileComplete })
    vi.mocked(api.users.updateMe).mockResolvedValue({ profile_complete: true } as never)
    render(<OnboardingProfilePage />)
    type('  Segun ', ' Oyelaran ')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: AUTH_COPY.profile.cta }))
    })
    expect(api.users.updateMe).toHaveBeenCalledWith({
      first_name: 'Segun',
      last_name: 'Oyelaran',
    })
    // Not a local guess — the server's own answer.
    expect(setProfileComplete).toHaveBeenCalledWith(true)
    expect(replace).toHaveBeenCalledWith('/home')
  })

  it('records a server answer of FALSE rather than assuming success', async () => {
    // The distinguishing case: with the mock answering `true`, "use the
    // server's value" and "hardcode true" look identical. The server can
    // answer false — a name that still fails its own completeness rule — and
    // storing `true` there would tell the whole app the profile is done.
    const setProfileComplete = vi.fn()
    useAuthStore.setState({ setProfileComplete })
    vi.mocked(api.users.updateMe).mockResolvedValue({ profile_complete: false } as never)
    render(<OnboardingProfilePage />)
    type('Segun', 'Oyelaran')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: AUTH_COPY.profile.cta }))
    })
    expect(setProfileComplete).toHaveBeenCalledWith(false)
  })

  it('never sends is_seeker — it is a device fee tier, not a preference', async () => {
    vi.mocked(api.users.updateMe).mockResolvedValue({ profile_complete: true } as never)
    render(<OnboardingProfilePage />)
    type('Segun', 'Oyelaran')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: AUTH_COPY.profile.cta }))
    })
    expect(api.users.updateMe).toHaveBeenCalledWith(
      expect.not.objectContaining({ is_seeker: expect.anything() }),
    )
  })

  it('stays put and ANNOUNCES a failed save', async () => {
    vi.mocked(api.users.updateMe).mockRejectedValue(new Error('down'))
    render(<OnboardingProfilePage />)
    type('Segun', 'Oyelaran')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: AUTH_COPY.profile.cta }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent(AUTH_COPY.profile.failed)
    expect(replace).not.toHaveBeenCalled()
  })

  it('bootstraps the session on a hard reload rather than assuming one', () => {
    // Arriving straight from verify the store is warm; a reload lands here cold
    // and must load the session instead of bouncing a signed-in reader out.
    const loadSession = vi.fn()
    useAuthStore.setState({ isLoading: true, isAuthenticated: false, loadSession })
    const { container } = render(<OnboardingProfilePage />)
    expect(loadSession).toHaveBeenCalled()
    // Nothing rendered and no redirect while the answer is still unknown.
    expect(container).toBeEmptyDOMElement()
    expect(replace).not.toHaveBeenCalled()
  })

  it('seeds the fields from a name the account already has', () => {
    // Someone who half-finished, or a wallet account created with a name.
    useAuthStore.setState({
      isLoading: false,
      isAuthenticated: true,
      user: { id: 'u1', first_name: 'Segun', last_name: 'Oyelaran' } as never,
    })
    render(<OnboardingProfilePage />)
    expect(screen.getByLabelText(AUTH_COPY.profile.first)).toHaveValue('Segun')
    expect(screen.getByLabelText(AUTH_COPY.profile.last)).toHaveValue('Oyelaran')
  })

  it('renders nothing for a visitor with no session', () => {
    useAuthStore.setState({ isLoading: false, isAuthenticated: false })
    const { container } = render(<OnboardingProfilePage />)
    expect(container).toBeEmptyDOMElement()
    expect(replace).toHaveBeenCalledWith('/signin')
  })
})
