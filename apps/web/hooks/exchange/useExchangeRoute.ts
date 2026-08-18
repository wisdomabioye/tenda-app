'use client'

/**
 * The exchange surface's list state, read from the URL.
 *
 * All three keys live there rather than in component state. The tab and the
 * two filters describe a view worth linking to, and — the part that is a bug
 * rather than a nicety — opening an offer navigates to `/exchange/<id>`, which
 * UNMOUNTS this page. State held here would be reset by the time the reader
 * comes back, so the filtered book they were reading would silently become the
 * unfiltered one.
 */
import { useSearchParams } from 'next/navigation'
import {
  exchangeCurrency,
  exchangeTab,
  type ExchangeRouteState,
} from '@/components/exchange/market/copy'

export function useExchangeRoute(): ExchangeRouteState {
  const search = useSearchParams()
  return {
    tab: exchangeTab(search.get('tab')),
    currency: exchangeCurrency(search.get('cur')),
    chainId: search.get('chain'),
  }
}
