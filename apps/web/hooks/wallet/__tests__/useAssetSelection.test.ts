/**
 * Which asset/chain the sell surface is working with.
 *
 * The property that matters is what happens when the option SET changes — a
 * wallet linked or unlinked mid-session must not leave the panel pointing at
 * an option that is no longer offered.
 */
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assetOptionKey, useAssetSelection } from '@/hooks/wallet/useAssetSelection'
import type { ExchangeAssetOption } from '@/hooks/exchange/useExchangeAssetOptions'

const options = vi.hoisted(() => ({ current: [] as ExchangeAssetOption[] }))
vi.mock('@/hooks/exchange/useExchangeAssetOptions', () => ({
  useExchangeAssetOptions: () => options.current,
}))

const opt = (over: Partial<ExchangeAssetOption> = {}): ExchangeAssetOption =>
  ({
    chainId: 'solana:devnet',
    assetId: 'USDC_SOL',
    symbol: 'USDC',
    decimals: 6,
    walletAddress: 'SoLAddr1',
    ...over,
  }) as ExchangeAssetOption

beforeEach(() => {
  options.current = []
})

describe('useAssetSelection', () => {
  it('is null when the reader has no verified wallet for anything', () => {
    const { result } = renderHook(() => useAssetSelection())
    expect(result.current.option).toBeNull()
    expect(result.current.selectedKey).toBe('')
  })

  it('defaults to the first option', () => {
    options.current = [opt(), opt({ chainId: 'eip155:84532', assetId: 'USDC_BASE' })]
    const { result } = renderHook(() => useAssetSelection())
    expect(result.current.option?.assetId).toBe('USDC_SOL')
  })

  it('honours a pick', () => {
    const base = opt({ chainId: 'eip155:84532', assetId: 'USDC_BASE' })
    options.current = [opt(), base]
    const { result } = renderHook(() => useAssetSelection())
    act(() => result.current.select(base))
    expect(result.current.option?.assetId).toBe('USDC_BASE')
  })

  it('re-resolves when the picked option DISAPPEARS mid-session', () => {
    const base = opt({ chainId: 'eip155:84532', assetId: 'USDC_BASE' })
    options.current = [opt(), base]
    const { result, rerender } = renderHook(() => useAssetSelection())
    act(() => result.current.select(base))
    expect(result.current.option?.assetId).toBe('USDC_BASE')

    // That wallet is unlinked; the option set shrinks.
    options.current = [opt()]
    rerender()
    expect(result.current.option?.assetId).toBe('USDC_SOL')
  })

  it('keys an option by chain, asset AND wallet — the same asset on two wallets is two options', () => {
    const a = opt({ walletAddress: 'SoLAddr1' })
    const b = opt({ walletAddress: 'SoLAddr2' })
    expect(assetOptionKey(a)).not.toEqual(assetOptionKey(b))
  })
})
