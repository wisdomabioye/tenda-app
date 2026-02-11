import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import type { users } from '../db/schema'

export type User = InferSelectModel<typeof users>
export type NewUser = InferInsertModel<typeof users>

export type PublicUser = Omit<User, 'wallet_address' | 'updated_at'>

export interface WalletAuthBody {
  wallet_address: string
  signature: string
  message: string
}

export interface UpdateUserInput {
  first_name?: string
  last_name?: string
  avatar_url?: string
  city?: string
}

export interface AuthResponse {
  token: string
  user: User
}
