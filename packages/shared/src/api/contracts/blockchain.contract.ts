import type { Endpoint } from '../endpoint'
import type { ClientPingBody, ClientPingResponse } from './escrows.contract'

export interface BlockchainContract {
  /** v2 client-ping (#62): report a broadcast tx for async verification. */
  clientPing: Endpoint<'POST', undefined, ClientPingBody, undefined, ClientPingResponse>
}
