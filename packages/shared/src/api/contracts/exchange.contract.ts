/**
 * Exchange order-book surface — read-only, gated by advanced_mode_enabled
 * (decision #14). Exchanges are escrows (kind='exchange'); creation and
 * transitions live in escrows.contract.
 */
import type { Endpoint } from '../endpoint'
import type { ExchangeSummary, ExchangeDetail, ExchangeListQuery } from '../../types'
import type { PaginatedResponse } from '../../types/api'

export interface ExchangeContract {
  list: Endpoint<'GET', undefined, undefined, ExchangeListQuery, PaginatedResponse<ExchangeSummary>>
  get: Endpoint<'GET', { id: string }, undefined, undefined, ExchangeDetail>
}
