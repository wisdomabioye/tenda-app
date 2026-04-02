import { apiRoutes } from '@tenda/shared'

/** Admin-specific route paths — all prefixed /v1/admin */
export const adminRoutes = {
  users: {
    list:         '/v1/admin/users',
    get:          '/v1/admin/users/:id',
    updateStatus: '/v1/admin/users/:id/status',
    updateRole:   '/v1/admin/users/:id/role',
  },
  gigs: {
    list:      '/v1/admin/gigs',
    get:       '/v1/admin/gigs/:id',
    hide:      '/v1/admin/gigs/:id/hide',
    unhide:    '/v1/admin/gigs/:id/unhide',
    expire:    '/v1/admin/gigs/:id/expire',
    feature:   '/v1/admin/gigs/:id/feature',
    unfeature: '/v1/admin/gigs/:id/unfeature',
  },
  exchange: {
    list:   '/v1/admin/exchange',
    get:    '/v1/admin/exchange/:id',
    hide:   '/v1/admin/exchange/:id/hide',
    unhide: '/v1/admin/exchange/:id/unhide',
  },
  reports: {
    list:   '/v1/admin/reports',
    action: '/v1/admin/reports/:id',
  },
  disputes: {
    list:           '/v1/admin/disputes',
    get:            '/v1/admin/disputes/:type/:id',
    openThread:     '/v1/admin/disputes/:type/:id/thread',
    getThread:      '/v1/admin/disputes/:type/:id/thread',
    sendMessage:    '/v1/admin/disputes/:type/:id/thread/messages',
    assignThread:   '/v1/admin/disputes/:type/:id/thread/assign',
    resolve:        '/v1/admin/disputes/:type/:id/resolve',
  },
  keywords: {
    list:    '/v1/admin/blocked-keywords',
    add:     '/v1/admin/blocked-keywords',
    remove:  '/v1/admin/blocked-keywords/:id',
    refresh: '/v1/admin/blocked-keywords/refresh',
  },
  config: {
    get:    '/v1/admin/platform-config',
    update: '/v1/admin/platform-config',
  },
  announcements: {
    list:   '/v1/admin/announcements',
    get:    '/v1/admin/announcements/:id',
    create: '/v1/admin/announcements',
    update: '/v1/admin/announcements/:id',
    remove: '/v1/admin/announcements/:id',
  },
  push: {
    broadcast: '/v1/admin/push/broadcast',
  },
  airdrop: {
    list:         '/v1/admin/airdrop',
    get:          '/v1/admin/airdrop/:id',
    create:       '/v1/admin/airdrop',
    addRecipients:'/v1/admin/airdrop/:id/recipients',
    approve:      '/v1/admin/airdrop/:id/approve',
    buildBatch:   '/v1/admin/airdrop/:id/batches/:batchIndex/build',
    confirmBatch: '/v1/admin/airdrop/:id/batches/:batchIndex/confirm',
  },
  finance: {
    fees:         '/v1/admin/finance/fees',
    transactions: '/v1/admin/finance/transactions',
  },
} as const

/** Shared routes re-exported for use in auth flows */
export { apiRoutes }
