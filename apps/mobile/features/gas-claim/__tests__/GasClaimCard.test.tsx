/**
 * The claim card (#53c-2): when the action appears, and when it must not.
 *
 * One assertion here matters more than the rest — a grant that is already
 * claimed, or already on its way, must NEVER render the claim button. That is
 * the surface's whole safety property: the server refuses a second claim, but a
 * button that offers one teaches the user the app is broken, and re-offering a
 * grant they already hold is the one thing this design set out to avoid.
 */
import { render, screen, fireEvent } from '@testing-library/react-native'
import type { GasSeedAvailability } from '@tenda/shared'
import { GasClaimCard } from '../GasClaimCard'
import { GAS_CLAIM_COPY, GAS_CLAIM_STATE_COPY } from '../copy'

// `StyleSheet` as well as `useUnistyles`, for the reason WalletBalanceRows'
// suite gives: the card reaches Text and Button through the `@/components/ui`
// barrel, which also pulls components that build styles at module load.
jest.mock('react-native-unistyles', () => ({
  StyleSheet: { create: (sheet: unknown) => sheet },
  useUnistyles: () => ({
    theme: {
      colors: {
        surface: { card: '#fff' },
        border: { default: '#ccc', subtle: '#eee' },
        content: { primary: '#000', secondary: '#333', tertiary: '#666' },
        brand: { primary: '#a60', primarySurface: '#fe8', onPrimary: '#fff' },
        feedback: { danger: { base: '#c00' } },
      },
    },
  }),
}))

jest.mock('@/stores/chain-registry.store', () => ({
  useChainRegistryStore: (select: (s: unknown) => unknown) =>
    select({
      chains: [
        {
          id: 'eip155:16661',
          assets: [
            { id: 'OG', symbol: 'OG', decimals: 18, token_address: null },
            { id: 'USDC_0G', symbol: 'USDC', decimals: 6, token_address: '0xusdc' },
          ],
        },
      ],
    }),
  selectChainById: (chains: { id: string }[] | null, id: string) =>
    chains?.find((c) => c.id === id) ?? null,
}))

function offer(over: Partial<GasSeedAvailability> = {}): GasSeedAvailability {
  return {
    chain_id: 'eip155:16661',
    available: true,
    amount_raw: '10000000000000000',
    state: 'unclaimed',
    reason: null,
    ...over,
  }
}

it('offers the claim, with the amount and the wallet that will receive it', () => {
  const onClaim = jest.fn()
  render(
    <GasClaimCard offer={offer()} claiming={false} onClaim={onClaim} walletAddress="0xabcdef0123456789" />,
  )

  // The amount is formatted from the chain REGISTRY's native asset, so it reads
  // as "0.01 0G" rather than as a base-unit integer. That is a ZERO, not the
  // letter O — the 0G token really is spelled that way, and a test written with
  // an O fails against correct code and reads like a bug in it.
  expect(screen.getByText(/0\.01 0G/)).toBeTruthy()
  expect(screen.getByText(/Paid to/)).toBeTruthy()

  fireEvent.press(screen.getByText(GAS_CLAIM_COPY.action))
  expect(onClaim).toHaveBeenCalledWith('eip155:16661')
})

it('a claim ALREADY UNDER WAY shows no action and does not say "claimed"', () => {
  render(
    <GasClaimCard
      offer={offer({ available: false, state: 'in_progress', reason: 'already_granted' })}
      claiming={false}
      onClaim={jest.fn()}
    />,
  )

  expect(screen.queryByText(GAS_CLAIM_COPY.action)).toBeNull()
  expect(screen.getByText(GAS_CLAIM_STATE_COPY.in_progress)).toBeTruthy()
})

it('a CLAIMED grant is never re-offered', () => {
  render(
    <GasClaimCard
      offer={offer({ available: false, state: 'claimed', reason: 'already_granted' })}
      claiming={false}
      onClaim={jest.fn()}
    />,
  )
  expect(screen.queryByText(GAS_CLAIM_COPY.action)).toBeNull()
  expect(screen.getByText(GAS_CLAIM_STATE_COPY.claimed)).toBeTruthy()
})

it('a refusal the user can act on is shown, without an action that would fail', () => {
  render(
    <GasClaimCard
      offer={offer({ available: false, state: 'unclaimed', reason: 'phone_required' })}
      claiming={false}
      onClaim={jest.fn()}
    />,
  )
  expect(screen.getByText(/Verify your phone number/)).toBeTruthy()
  expect(screen.queryByText(GAS_CLAIM_COPY.action)).toBeNull()
})

it('the wallet address is shown only when a claim is actually on offer', () => {
  // After the grant exists, the wallet screen's own rows are the better answer,
  // and on a refused chain the address is noise.
  render(
    <GasClaimCard
      offer={offer({ available: false, state: 'claimed', reason: 'already_granted' })}
      claiming={false}
      onClaim={jest.fn()}
      walletAddress="0xabcdef0123456789"
    />,
  )
  expect(screen.queryByText(/Paid to/)).toBeNull()
})

it('an unknown chain renders WITHOUT an amount rather than a base-unit integer', () => {
  // The registry may not have loaded, or may not carry this chain. "10000000000000000"
  // beside the word gas is worse than saying nothing about the size.
  render(
    <GasClaimCard offer={offer({ chain_id: 'solana:devnet' })} claiming={false} onClaim={jest.fn()} />,
  )
  expect(screen.queryByText(/10000000000000000/)).toBeNull()
  expect(screen.getByText(GAS_CLAIM_COPY.action)).toBeTruthy()
})

it('the inline variant leads with the gas problem, not with the offer', () => {
  render(
    <GasClaimCard offer={offer()} claiming={false} onClaim={jest.fn()} variant="inline" />,
  )
  expect(screen.getByText(new RegExp(GAS_CLAIM_COPY.promptTitle))).toBeTruthy()
})

it('while a claim is in flight the label is replaced by the spinner, not duplicated', () => {
  // `Button` renders an ActivityIndicator INSTEAD of its children when loading,
  // so the card must not also carry a "Claiming…" string — it could never show.
  render(<GasClaimCard offer={offer()} claiming onClaim={jest.fn()} />)
  expect(screen.queryByText(GAS_CLAIM_COPY.action)).toBeNull()
})
