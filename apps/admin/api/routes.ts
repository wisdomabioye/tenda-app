/**
 * v2 admin route paths (#90) — only surfaces that EXIST on the server.
 * Path params use :placeholders resolved by api/client.ts buildPath.
 */
export const adminRoutes = {
  auth: {
    sendEmailOtp: '/v1/auth/admin/send-email-otp',
    verifyEmailOtp: '/v1/auth/admin/verify-email-otp',
  },
  users: {
    list: '/v1/admin/users',
    get: '/v1/admin/users/:id',
    updateStatus: '/v1/admin/users/:id/status',
    updateRole: '/v1/admin/users/:id/role',
    grantLoginEmail: '/v1/admin/users/:id/login-email',
    revokeLoginEmail: '/v1/admin/users/:id/login-email',
  },
  escrows: {
    list: '/v1/admin/escrows',
    setHidden: '/v1/admin/escrows/:id/hidden',
  },
  disputes: {
    list: '/v1/admin/disputes',
    claim: '/v1/admin/disputes/:id/claim',
    release: '/v1/admin/disputes/:id/release',
  },
  disputeThread: {
    // Thread routes live on the escrow (shared with the parties).
    messages: '/v1/escrows/:id/dispute/messages',
    resolve: '/v1/escrows/:id/resolve',
  },
  reports: {
    list: '/v1/admin/reports',
    action: '/v1/admin/reports/:id',
  },
  featured: {
    list: '/v1/admin/featured',
    create: '/v1/admin/featured',
    update: '/v1/admin/featured/:id',
    remove: '/v1/admin/featured/:id',
  },
  standing: {
    get: '/v1/admin/standing/:user_id',
    override: '/v1/admin/standing/:user_id/override',
  },
  platformConfig: '/v1/admin/platform-config',
  announcements: {
    list: '/v1/admin/announcements',
    create: '/v1/admin/announcements',
    update: '/v1/admin/announcements/:id',
    remove: '/v1/admin/announcements/:id',
  },
  moderation: '/v1/admin/moderation',
  finance: '/v1/admin/finance',
  metrics: '/v1/admin/metrics',
  fiat: '/v1/admin/fiat',
  push: { broadcast: '/v1/admin/push' },
} as const

/** Replace :params in a route path; throws on a missing param. */
export function buildPath(template: string, params: Record<string, string>): string {
  return template.replace(/:([A-Za-z_]+)/g, (_, name: string) => {
    const value = params[name]
    if (value === undefined) throw new Error(`missing path param '${name}' for ${template}`)
    return encodeURIComponent(value)
  })
}
