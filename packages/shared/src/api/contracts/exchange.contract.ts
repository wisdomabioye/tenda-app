/**
 * Exchange order-book surface — gated by advanced_mode_enabled
 * (decision #14). Exchanges are escrows (kind='exchange'); the
 * chain-agnostic core and transitions live in escrows.contract; `create`
 * attaches the exchange_details satellite to a draft (CO4).
 */
import type { Endpoint } from '../endpoint'
import type {
  ExchangeSummary,
  ExchangeDetail,
  ExchangeListQuery,
  CreateExchangeDetailsBody,
  ExchangeDetailsRow,
} from '../../types'
import type { PaginatedResponse } from '../../types/api'

export interface ExchangeContract {
  list: Endpoint<'GET', undefined, undefined, ExchangeListQuery, PaginatedResponse<ExchangeSummary>>
  create: Endpoint<'POST', undefined, CreateExchangeDetailsBody, undefined, ExchangeDetailsRow>
  get: Endpoint<'GET', { id: string }, undefined, undefined, ExchangeDetail>
}
