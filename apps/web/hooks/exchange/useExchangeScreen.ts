/**
 * Web port of apps/mobile/hooks/useExchangeScreen.ts: the public order
 * book and the caller's own trades, each independently paginated.
 *
 * The filters arrive as ARGUMENTS rather than living here. They ride the URL
 * (`useExchangeRoute`), because opening an offer unmounts this surface and
 * local state would drop the reader's filters on the way back. Both lists load
 * whichever tab is showing, so the inactive tab's count is a real server total
 * rather than a zero for a list nobody fetched — the same rule My Gigs follows.
 *
 * Mobile's focus refresh has no web analogue (the page remounts per navigation).
 */
import type {
  EscrowListRow,
  ExchangeListQuery,
  ExchangeSummary,
  SupportedCurrency,
  UserEscrowsQuery,
} from '@tenda/shared'
import { api } from '@/api/client'
import { usePaginatedList, type PaginatedListState } from '@/hooks/pagination/usePaginatedList'
import { useAuthStore } from '@/stores/auth.store'
import { myTradesCache, offerBookCache } from '@/lib/account-state'

export interface ExchangeScreenState {
  market: PaginatedListState<ExchangeSummary>
  myTrades: PaginatedListState<EscrowListRow>
}

export interface ExchangeScreenFilters {
  currency: SupportedCurrency | null
  chainId: string | null
  /**
   * False while the surface is locked. Exchange is behind the CO4 advanced-mode
   * toggle and BOTH endpoints enforce it, so fetching for a locked reader is
   * two requests that can only come back refused — and the refusal would paint
   * an error over a screen whose real message is "turn this on in Settings".
   */
  enabled?: boolean
}

const offerKey = (offer: ExchangeSummary) => offer.escrow_id
const escrowKey = (row: EscrowListRow) => row.id

export function useExchangeScreen({
  currency,
  chainId,
  enabled = true,
}: ExchangeScreenFilters): ExchangeScreenState {
  const user = useAuthStore((s) => s.user)

  const market = usePaginatedList<ExchangeSummary, ExchangeListQuery>({
    fetchPage: (params) => api.exchange.list(params),
    query: {
      currency: currency ?? undefined,
      chain_id: chainId ?? undefined,
    },
    keyOf: offerKey,
    enabled,
    cache: offerBookCache,
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
    enabled: enabled && userId !== null,
    cache: myTradesCache,
  })

  return { market, myTrades }
}
