import { useEffect, useRef, useState } from 'react'
import { solanaChainId, solanaNativeAssetId, type FiatQuoteResponse } from '@tenda/shared'
import { api, ApiClientError } from '@/api/client'
import { SOLANA_NETWORK } from '@/wallet/config'
import { useAuthStore } from '@/stores/auth.store'

const DEBOUNCE_MS = 600

export interface FiatQuoteState {
  quote: FiatQuoteResponse | null
  /** Seconds until the active quote expires (0 when none/expired). */
  expiresIn: number
  loading: boolean
  /** User-facing error ('unavailable' carries special copy). */
  error: 'unavailable' | 'failed' | null
}

export interface FiatQuoteInput {
  direction: 'onramp' | 'offramp'
  /** Onramp: NGN the user pays. */
  fiatAmount?: number
  /** Offramp: lamports the user sells. */
  assetAmountRaw?: string
}

/**
 * Debounced fiat quote (stage-8 § mobile useFiatQuote) with an expiry
 * countdown so the UI can prompt a re-quote. Naira-first: the currency is
 * fixed to NGN at launch.
 */
export function useFiatQuote(input: FiatQuoteInput | null): FiatQuoteState {
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const [state, setState] = useState<FiatQuoteState>({ quote: null, expiresIn: 0, loading: false, error: null })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seq = useRef(0)

  const direction = input?.direction ?? null
  const fiatAmount = input?.fiatAmount
  const assetAmountRaw = input?.assetAmountRaw

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    const ready =
      direction !== null &&
      walletAddress !== null &&
      (direction === 'onramp'
        ? fiatAmount !== undefined && fiatAmount > 0
        : assetAmountRaw !== undefined && assetAmountRaw !== '0' && assetAmountRaw !== '')
    if (!ready) {
      setState({ quote: null, expiresIn: 0, loading: false, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    timer.current = setTimeout(() => {
      const mySeq = ++seq.current
      api.fiat
        .quote({
          direction,
          fiat_currency: 'NGN',
          ...(direction === 'onramp' ? { fiat_amount: fiatAmount } : {}),
          ...(direction === 'offramp' ? { asset_amount_raw: assetAmountRaw } : {}),
          asset: solanaNativeAssetId(SOLANA_NETWORK),
          chain_id: solanaChainId(SOLANA_NETWORK),
          wallet_address: walletAddress,
        })
        .then((quote) => {
          if (mySeq !== seq.current) return
          setState({ quote, expiresIn: secondsUntil(quote.expires_at), loading: false, error: null })
        })
        .catch((e: unknown) => {
          if (mySeq !== seq.current) return
          const unavailable =
            e instanceof ApiClientError && (e.code === 'PROVIDER_UNAVAILABLE' || e.code === 'FIAT_RAILS_DISABLED')
          setState({ quote: null, expiresIn: 0, loading: false, error: unavailable ? 'unavailable' : 'failed' })
        })
    }, DEBOUNCE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [direction, fiatAmount, assetAmountRaw, walletAddress])

  // Countdown tick while a quote is live.
  useEffect(() => {
    if (state.quote === null || state.expiresIn <= 0) return
    const t = setTimeout(() => {
      setState((s) =>
        s.quote === null ? s : { ...s, expiresIn: secondsUntil(s.quote.expires_at) },
      )
    }, 1_000)
    return () => clearTimeout(t)
  }, [state.quote, state.expiresIn])

  return state
}

function secondsUntil(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1_000))
}
