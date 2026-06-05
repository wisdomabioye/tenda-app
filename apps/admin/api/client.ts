/**
 * Typed v2 admin API client (#90). Thin: paths from api/routes.ts, HTTP
 * core from lib/api.ts (bearer header + 401 logout). Namespaces grow with
 * the dashboard build order — #91 disputes, #92 reports/users, #93 ops —
 * so every method here maps to a route that EXISTS on the server today.
 */

import type {
  DisputeMessage,
  DisputeSummary,
  DisputeThreadResponse,
  PaginatedResponse,
} from '@tenda/shared'
import type { AdminSessionUser } from '@/lib/auth'
import { api } from '@/lib/api'
import { adminRoutes, buildPath } from './routes'

export interface VerifyEmailOtpResponse {
  token: string
  expires_in: string
  user: AdminSessionUser
}

// type (not interface): keeps the implicit index signature Record needs.
export type DisputeListQuery = {
  status?: 'open' | 'resolved'
  kind?: 'gig' | 'exchange'
  assigned?: 'me' | 'none'
  limit?: number
  offset?: number
}

function withQuery(path: string, params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) q.set(key, String(value))
  }
  const qs = q.toString()
  return qs === '' ? path : `${path}?${qs}`
}

export const adminApi = {
  auth: {
    sendEmailOtp: (body: { email: string }) =>
      api.post<{ sent: boolean; expires_in: number }>(adminRoutes.auth.sendEmailOtp, body),
    verifyEmailOtp: (body: { email: string; code: string }) =>
      api.post<VerifyEmailOtpResponse>(adminRoutes.auth.verifyEmailOtp, body),
  },
  users: {
    grantLoginEmail: (id: string, email: string) =>
      api.put<{ user_id: string; email: string; role: string }>(
        buildPath(adminRoutes.users.grantLoginEmail, { id }),
        { email },
      ),
    revokeLoginEmail: (id: string) =>
      api.delete<{ user_id: string; revoked: boolean }>(
        buildPath(adminRoutes.users.revokeLoginEmail, { id }),
      ),
  },
  disputes: {
    list: (query: DisputeListQuery = {}) =>
      api.get<PaginatedResponse<DisputeSummary>>(withQuery(adminRoutes.disputes.list, query)),
    get: (id: string) => api.get<DisputeSummary>(buildPath(adminRoutes.disputes.get, { id })),
    claim: (id: string) =>
      api.post<{ id: string; assigned_to_id: string }>(
        buildPath(adminRoutes.disputes.claim, { id }),
      ),
    release: (id: string) =>
      api.post<{ id: string; assigned_to_id: null }>(
        buildPath(adminRoutes.disputes.release, { id }),
      ),
  },
  disputeThread: {
    /** Thread rides the ESCROW id (shared with the parties' app). */
    get: (escrowId: string, after?: string) =>
      api.get<DisputeThreadResponse>(
        withQuery(buildPath(adminRoutes.disputeThread.messages, { id: escrowId }), { after }),
      ),
    send: (escrowId: string, body: string) =>
      api.post<DisputeMessage>(buildPath(adminRoutes.disputeThread.messages, { id: escrowId }), {
        body,
      }),
  },
}
