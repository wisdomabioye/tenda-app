/**
 * Wallet sign-in panel states: idle/connect, decline → quiet idle,
 * WALLET_NOT_LINKED as a FIRST-CLASS panel (email CTA + fresh retry),
 * classified errors, and the not-configured build.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiClientError } from '@tenda/shared'

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mockReplace }) }))

const mockSignInWithWallet = vi.fn()
const mockGetState = vi.fn(() => ({ profileComplete: true }))
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: Object.assign(
    (sel: (s: { signInWithWallet: typeof mockSignInWithWallet }) => unknown) =>
      sel({ signInWithWallet: mockSignInWithWallet }),
    { getState: () => mockGetState() },
  ),
}))

const mockIsAvailable = vi.fn(async () => true)
const mockDisconnect = vi.fn(async () => {})
vi.mock('@/wallet/adapters/reown', () => ({
  reownAdapter: {
    isAvailable: () => mockIsAvailable(),
    disconnect: () => mockDisconnect(),
  },
}))

import { WalletSignInPanel } from '@/components/auth/WalletSignInPanel'

async function clickConnect() {
  const button = await screen.findByRole('button', { name: 'Connect wallet' })
  await waitFor(() => expect(button).toBeEnabled())
  await userEvent.click(button)
}

describe('idle + success', () => {
  it('signs in and routes home when the profile is complete', async () => {
    mockSignInWithWallet.mockResolvedValue(true)
    mockGetState.mockReturnValue({ profileComplete: true })
    render(<WalletSignInPanel />)
    await clickConnect()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/home'))
  })

  it('routes to onboarding when the profile is incomplete', async () => {
    mockSignInWithWallet.mockResolvedValue(true)
    mockGetState.mockReturnValue({ profileComplete: false })
    render(<WalletSignInPanel />)
    await clickConnect()
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/onboarding/profile'))
  })

  it('a decline quietly returns to idle — no error banner, no navigation', async () => {
    mockSignInWithWallet.mockResolvedValue(false)
    render(<WalletSignInPanel />)
    await clickConnect()
    expect(await screen.findByRole('button', { name: 'Connect wallet' })).toBeEnabled()
    expect(mockReplace).not.toHaveBeenCalled()
    expect(screen.queryByText(/went wrong|cancelled/i)).toBeNull()
  })
})

describe('WALLET_NOT_LINKED — first-class state', () => {
  it('renders the explainer with the email CTA and a fresh retry', async () => {
    mockSignInWithWallet.mockRejectedValue(
      new ApiClientError(404, 'Not Found', 'wallet not linked', 'WALLET_NOT_LINKED'),
    )
    render(<WalletSignInPanel />)
    await clickConnect()

    expect(await screen.findByText('This wallet isn’t linked yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue with email' })).toHaveAttribute('href', '/signin/email')

    // "Try another wallet" drops the session BEFORE reconnecting, so the
    // modal re-opens instead of fast-pathing back to the wallet that 404'd.
    mockSignInWithWallet.mockResolvedValue(true)
    await userEvent.click(screen.getByRole('button', { name: 'Try another wallet' }))
    await waitFor(() => expect(mockDisconnect).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockReplace).toHaveBeenCalled())
  })
})

describe('errors + availability', () => {
  it('renders the classified copy for other failures, with retry', async () => {
    mockSignInWithWallet.mockRejectedValue(new ApiClientError(401, 'Unauthorized', 'bad sig'))
    render(<WalletSignInPanel />)
    await clickConnect()
    expect(await screen.findByText('Sign-in failed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('an unconfigured build hides the connect button and points at email', async () => {
    mockIsAvailable.mockResolvedValue(false)
    render(<WalletSignInPanel />)
    expect(await screen.findByText(/not configured for this build/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect wallet' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Continue with email' })).toBeInTheDocument()
  })
})
