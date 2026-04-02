import { ADMIN_ROLES, solanaChainId } from '@tenda/shared'
import type { AuthResponse, UserRole } from '@tenda/shared'

const TOKEN_KEY  = 'admin_token'
const COOKIE_NAME = 'admin_token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
  document.cookie = `${COOKIE_NAME}=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Strict`
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`
}

export function parseJwt(token: string): { role: UserRole; id: string; wallet_address: string } | null {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

export function isAdminRole(role: UserRole): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(role)
}

/** Build the sign-in message expected by POST /v1/auth/wallet */
export function buildAuthMessage(): string {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet'
  return [
    'Tenda Admin Auth',
    `Timestamp: ${new Date().toISOString()}`,
    `Chain: ${solanaChainId(network)}`,
  ].join('\n')
}

export type { AuthResponse }
