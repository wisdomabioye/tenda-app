import type { Endpoint } from '../endpoint'
import type { WalletAuthBody, AuthResponse, User } from '../../types'

export interface AuthContract {
  wallet: Endpoint<'POST', undefined, WalletAuthBody, undefined, AuthResponse>
  me: Endpoint<'GET', undefined, undefined, undefined, User>
}
