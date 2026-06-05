import type { ApiError as SharedApiError, PaginatedResponse } from '@tenda/shared'
import { getToken, clearSession } from './auth'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (init.headers) Object.assign(headers, init.headers)
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers })

  if (res.status === 401 && !path.startsWith('/v1/auth/')) {
    // Expired/revoked session — the server is the verifier (no middleware).
    // Auth routes are excluded: a wrong OTP must surface inline, not bounce.
    clearSession()
    window.location.href = '/login'
    throw new ApiError(401, 'UNAUTHORIZED', 'Session expired')
  }

  if (!res.ok) {
    const body: Partial<SharedApiError> = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.code ?? 'API_ERROR', body.message ?? `Request failed: ${res.status}`)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get:    <T>(path: string)                     => request<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body?: object)      => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body?: object)      => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  put:    <T>(path: string, body?: object)      => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string)                     => request<T>(path, { method: 'DELETE' }),
}

export type { PaginatedResponse }
