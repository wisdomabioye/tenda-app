/**
 * Typed v2 admin API client (#90). Thin: paths from api/routes.ts, HTTP
 * core from lib/api.ts (bearer header + 401 logout). Namespaces grow with
 * the dashboard build order — #91 disputes, #92 reports/users, #93 ops —
 * so every method here maps to a route that EXISTS on the server today.
 */

import type { AdminSessionUser } from '@/lib/auth'
import { api } from '@/lib/api'
import { adminRoutes, buildPath } from './routes'

export interface VerifyEmailOtpResponse {
  token: string
  expires_in: string
  user: AdminSessionUser
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
}
