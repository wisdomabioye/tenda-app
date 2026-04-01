import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import type { users, userStatusEnum } from '../db/schema'
import { userRoleEnum } from '../db/schema'

export type User = InferSelectModel<typeof users>
export type NewUser = InferInsertModel<typeof users>

export type UserRole   = typeof userRoleEnum.enumValues[number]
export type UserStatus = typeof userStatusEnum.enumValues[number] // 'active' | 'suspended'

// All roles that grant admin panel access. Use this for role guards and permission checks.
// 'admin' is the legacy value (pre-migration alias for 'super_admin') — included for backward compat.
export type AdminRole = Exclude<UserRole, 'user'>

export const ADMIN_ROLES: readonly AdminRole[] = [
  'super_admin', 'dispute_resolver', 'support', 'moderator', 'marketing', 'airdrop', 'finance', 'admin',
] as const

// Roles that can be assigned via PATCH /admin/users/:id/role.
// Excludes the deprecated 'admin' alias — new assignments must use 'super_admin'.
export const ASSIGNABLE_ROLES: readonly UserRole[] = userRoleEnum.enumValues.filter(
  (r): r is UserRole => r !== 'admin'
) as readonly UserRole[]

export type PublicUser = Omit<User, 'wallet_address' | 'updated_at' | 'status' | 'last_active_at'>

export interface WalletAuthBody {
  wallet_address: string
  signature: string
  message: string
  is_seeker?: boolean
  country?: string
}

export interface UpdateUserInput {
  first_name?: string
  last_name?: string
  avatar_url?: string
  bio?: string | null
  country?: string
  city?: string
  latitude?: number | null
  longitude?: number | null
}

export interface AuthResponse {
  token: string
  user: User
}
