import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import type { users, userRoleEnum, userStatusEnum } from '../db/schema'

export type User = InferSelectModel<typeof users>
export type NewUser = InferInsertModel<typeof users>

export type UserRole   = typeof userRoleEnum.enumValues[number]   // 'user' | 'admin'
export type UserStatus = typeof userStatusEnum.enumValues[number] // 'active' | 'suspended'

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
  bio?: string | null
  city?: string
  latitude?: number | null
  longitude?: number | null
}

export interface AuthResponse {
  token: string
  user: User
}
