/**
 * SigningWalletRow — renders the hook's answer: the signer + chain as a
 * fact, Switch wired to the hook action, a refused pick surfaced as an
 * alert, and nothing at all off-manifest.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SigningWallet } from '@/hooks/wallet/useSigningWallet'

const { hookMock, balanceMock } = vi.hoisted(() => ({ hookMock: vi.fn(), balanceMock: vi.fn() }))
vi.mock('@/hooks/wallet/useSigningWallet', () => ({
  useSigningWallet: (chainId: string) => hookMock(chainId),
}))
vi.mock('@/hooks/wallet/useSignerBalance', () => ({
  useSignerBalance: (...a: unknown[]) => balanceMock(...a),
}))

import { SigningWalletRow } from '@/components/wallet/SigningWalletRow'

function signer(over: Partial<SigningWallet> = {}): SigningWallet {
  return {
    namespace: 'eip155',
    address: '0xAbCdEfAbCdEfAbCdEfAb',
    switching: false,
    error: null,
    switchWallet: vi.fn(async () => {}),
    ...over,
  }
}

beforeEach(() => {
  hookMock.mockReturnValue(signer())
  balanceMock.mockReturnValue({ funds: 'unknown', availableRaw: null })
})

describe('SigningWalletRow', () => {
  it('states the signer and chain as a fact', () => {
    render(<SigningWalletRow chainId="eip155:84532" />)
    expect(hookMock).toHaveBeenCalledWith('eip155:84532')
    expect(screen.getByText(/Signing with/)).toBeInTheDocument()
    expect(screen.getByText('0xAb…EfAb')).toBeInTheDocument()
    expect(screen.getByText(/Base Sepolia/)).toBeInTheDocument()
  })

  it('Switch triggers the hook action; busy state disables and relabels it', async () => {
    const s = signer()
    hookMock.mockReturnValue(s)
    render(<SigningWalletRow chainId="eip155:84532" />)
    await userEvent.click(screen.getByRole('button', { name: 'Switch' }))
    expect(s.switchWallet).toHaveBeenCalledTimes(1)

    hookMock.mockReturnValue(signer({ switching: true }))
    render(<SigningWalletRow chainId="eip155:84532" />)
    expect(screen.getByRole('button', { name: 'Waiting…' })).toBeDisabled()
  })

  it('a refused pick surfaces as an alert; no linked wallet reads as one', () => {
    hookMock.mockReturnValue(signer({ error: 'Connect one of your linked wallets (0xAb…EfAb)' }))
    render(<SigningWalletRow chainId="eip155:84532" />)
    expect(screen.getByRole('alert')).toHaveTextContent('linked wallets')

    hookMock.mockReturnValue(signer({ address: null }))
    render(<SigningWalletRow chainId="eip155:84532" />)
    expect(screen.getByText('no linked wallet')).toBeInTheDocument()
  })

  it('renders nothing for a chain the manifest does not know', () => {
    hookMock.mockReturnValue(signer({ namespace: null, address: null }))
    const { container } = render(<SigningWalletRow chainId="eip155:999999" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('a spend the signer positively cannot cover warns with both amounts', () => {
    balanceMock.mockReturnValue({ funds: 'short', availableRaw: '10000000' })
    render(
      <SigningWalletRow
        chainId="eip155:84532"
        spend={{ assetId: 'USDC_BASE', amountRaw: '50000000' }}
      />,
    )
    // The signer-scoped read: (chainId, spend, previewed address).
    expect(balanceMock).toHaveBeenCalledWith(
      'eip155:84532',
      { assetId: 'USDC_BASE', amountRaw: '50000000' },
      '0xAbCdEfAbCdEfAbCdEfAb',
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This wallet holds 10 USDC but 50 USDC is needed',
    )
  })

  it('a covered or unknown balance stays silent — only a positive shortfall warns', () => {
    balanceMock.mockReturnValue({ funds: 'ok', availableRaw: '50000000' })
    const spend = { assetId: 'USDC_BASE', amountRaw: '50000000' }
    const ok = render(<SigningWalletRow chainId="eip155:84532" spend={spend} />)
    expect(ok.container.textContent).not.toContain('is needed')
    ok.unmount()

    balanceMock.mockReturnValue({ funds: 'unknown', availableRaw: null })
    const unknown = render(<SigningWalletRow chainId="eip155:84532" spend={spend} />)
    expect(unknown.container.textContent).not.toContain('is needed')
  })

  it('without a spend the balance hook is disarmed (null spend)', () => {
    render(<SigningWalletRow chainId="eip155:84532" />)
    expect(balanceMock).toHaveBeenCalledWith('eip155:84532', null, '0xAbCdEfAbCdEfAbCdEfAb')
  })
})
