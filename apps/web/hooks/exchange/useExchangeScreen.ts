/**
 * Web port of apps/mobile/hooks/useExchangeScreen.ts: the public order
 * book and the caller's own trades, each independently paginated, plus
 * the shared currency/chain filters. Mobile's focus refresh has no web
 * analogue (the page remounts per navigation).
 */
import { useCallback, useState } from 'react'
import type { EscrowListRow, ExchangeListQuery, ExchangeSummary, UserEscrowsQuery } from '@tenda/shared'
import { api } from '@/api/client'
import { usePaginatedList, type PaginatedListState } from '@/hooks/pagination/usePaginatedList'
import { useAuthStore } from '@/stores/auth.store'

export interface ExchangeScreenState {
  market: PaginatedListState<ExchangeSummary>
  myTrades: PaginatedListState<EscrowListRow>
  currency: string | null
  chainId: string | null
  setCurrency: (currency: string | null) => void
  setChainId: (chain_id: string | null) => void
  clearFilters: () => void
}

const offerKey = (offer: ExchangeSummary) => offer.escrow_id
const escrowKey = (row: EscrowListRow) => row.id

export function useExchangeScreen(): ExchangeScreenState {
  const user = useAuthStore((s) => s.user)
  const [currency, setCurrency] = useState<string | null>(null)
  const [chainId, setChainId] = useState<string | null>(null)

  const market = usePaginatedList<ExchangeSummary, ExchangeListQuery>({
    fetchPage: (params) => api.exchange.list(params),
    query: {
      currency: currency ?? undefined,
      chain_id: chainId ?? undefined,
    },
    keyOf: offerKey,
    // Read-only order book behind currency + chain chips: remember page 0
    // per filter combination, like the home feed.
    cacheQueries: true,
  })

  const userId = user?.id ?? null
  const myTrades = usePaginatedList<EscrowListRow, UserEscrowsQuery>({
    // No role filter → both sides: offers posted (creator) and offers
    // accepted (counterparty). The row derives selling/buying from creator_id.
    fetchPage: (params) => api.users.escrows({ id: userId ?? '' }, params),
    query: { kind: 'exchange', chain_id: chainId ?? undefined },
    keyOf: escrowKey,
    // Never issue the request without an id — it would 403 on someone
    // else's escrows rather than simply not running.
    enabled: userId !== null,
  })

  const clearFilters = useCallback(() => {
    setCurrency(null)
    setChainId(null)
  }, [])

  return { market, myTrades, currency, chainId, setCurrency, setChainId, clearFilters }
}
