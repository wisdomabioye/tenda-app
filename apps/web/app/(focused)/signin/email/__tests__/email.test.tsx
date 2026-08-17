/**
 * The email step. Two properties carry weight here: the address never reaches
 * the URL (the flow store exists for that), and the step is reachable BACKWARDS
 * from verify, where it must show the address it is offering to change.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import SignInEmailPage from '@/app/(focused)/signin/email/page'
import { AUTH_COPY } from '@/components/auth/copy'
import { api } from '@/api/client'
import { useSigninFlowStore } from '@/stores/signin-flow.store'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }))
vi.mock('@/api/client', () => ({ api: { auth: { challenge: vi.fn() } } }))

describe('SignInEmailPage', () => {
  beforeEach(() => {
    push.mockClear()
    useSigninFlowStore.setState({ pending: null })
  })
  afterEach(cleanup)

  const submit = async (email: string) => {
    fireEvent.change(screen.getByLabelText(AUTH_COPY.email.label), { target: { value: email } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: AUTH_COPY.email.cta }))
    })
  }

  it('starts empty when there is no pending challenge', () => {
    render(<SignInEmailPage />)
    expect(screen.getByLabelText(AUTH_COPY.email.label)).toHaveValue('')
  })

  it('shows the address it is offering to CHANGE when you come back', () => {
    // The verify step's back link is labelled "Change email"; landing on an
    // empty box makes you retype what you were only trying to check.
    useSigninFlowStore.setState({
      pending: { channel: 'email', identifier: 'ada@x.io', sentAt: 0, expiresIn: 600 },
    })
    render(<SignInEmailPage />)
    expect(screen.getByLabelText(AUTH_COPY.email.label)).toHaveValue('ada@x.io')
  })

  it('does not fight the reader typing over the seeded value', () => {
    // Seeded as INITIAL state only — a later store read must not reset it.
    useSigninFlowStore.setState({
      pending: { channel: 'email', identifier: 'ada@x.io', sentAt: 0, expiresIn: 600 },
    })
    render(<SignInEmailPage />)
    const field = screen.getByLabelText(AUTH_COPY.email.label)
    fireEvent.change(field, { target: { value: 'chidi@x.io' } })
    expect(field).toHaveValue('chidi@x.io')
  })

  it('sends the challenge, stores the SERVER’s window, and moves on', async () => {
    vi.mocked(api.auth.challenge).mockResolvedValue({ expires_in: 300 })
    render(<SignInEmailPage />)
    await submit('Ada@Example.COM ')
    // Normalised before it leaves — the same identifier the verify step sends,
    // so a case difference cannot split one account across two challenges.
    expect(api.auth.challenge).toHaveBeenCalledWith({
      method: 'email',
      identifier: 'ada@example.com',
    })
    expect(useSigninFlowStore.getState().pending).toMatchObject({
      identifier: 'ada@example.com',
      expiresIn: 300,
    })
    expect(push).toHaveBeenCalledWith('/signin/verify')
  })

  it('keeps a null window null rather than inventing one', async () => {
    vi.mocked(api.auth.challenge).mockResolvedValue({})
    render(<SignInEmailPage />)
    await submit('ada@x.io')
    expect(useSigninFlowStore.getState().pending?.expiresIn).toBeNull()
  })

  it('stays put and ANNOUNCES a failed challenge', async () => {
    vi.mocked(api.auth.challenge).mockRejectedValue(new Error('down'))
    render(<SignInEmailPage />)
    await submit('ada@x.io')
    expect(screen.getByRole('alert')).toHaveTextContent(AUTH_COPY.email.failed)
    expect(push).not.toHaveBeenCalled()
    // No pending challenge, so the verify step cannot be reached without one.
    expect(useSigninFlowStore.getState().pending).toBeNull()
  })

  it('refuses to send to something that is not an address', () => {
    render(<SignInEmailPage />)
    fireEvent.change(screen.getByLabelText(AUTH_COPY.email.label), { target: { value: 'nope' } })
    expect(screen.getByRole('button', { name: AUTH_COPY.email.cta })).toBeDisabled()
    expect(screen.getByText(AUTH_COPY.email.invalid)).toBeInTheDocument()
  })

  it('says what happens if the address is already taken', () => {
    // The question this step actually raises for someone who cannot remember
    // whether they signed up.
    render(<SignInEmailPage />)
    expect(screen.getByText(AUTH_COPY.email.collision)).toBeInTheDocument()
  })
})
