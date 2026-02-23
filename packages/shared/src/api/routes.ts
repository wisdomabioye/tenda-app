import type { ApiContract } from './contracts'

export const apiRoutes: {
  [K in keyof ApiContract]: { [A in keyof ApiContract[K]]: string }
} = {
  auth: {
    wallet: '/v1/auth/wallet',
    me: '/v1/auth/me',
  },
  gigs: {
    list: '/v1/gigs',
    create: '/v1/gigs',
    get: '/v1/gigs/:id',
    update: '/v1/gigs/:id',
    delete: '/v1/gigs/:id',
    publish: '/v1/gigs/:id/publish',
    accept: '/v1/gigs/:id/accept',
    submit: '/v1/gigs/:id/submit',
    approve: '/v1/gigs/:id/approve',
    dispute: '/v1/gigs/:id/dispute',
    resolve: '/v1/gigs/:id/resolve',
    refund: '/v1/gigs/:id/refund',
    review: '/v1/gigs/:id/review',
    transactions: '/v1/gigs/:id/transactions',
  },
  users: {
    get: '/v1/users/:id',
    update: '/v1/users/:id',
    gigs: '/v1/users/:id/gigs',
    reviews: '/v1/users/:id/reviews',
    transactions: '/v1/users/:id/transactions',
  },
  upload: {
    signature: '/v1/upload/signature',
  },
  blockchain: {
    transaction:       '/v1/blockchain/transaction/:signature',
    createEscrow:      '/v1/blockchain/create-escrow',
    approveEscrow:     '/v1/blockchain/approve-escrow',
    cancelEscrow:      '/v1/blockchain/cancel-escrow',
    acceptGig:         '/v1/blockchain/accept-gig',
    submitProof:       '/v1/blockchain/submit-proof',
    refundExpired:     '/v1/blockchain/refund-expired',
    disputeGig:        '/v1/blockchain/dispute-gig',
    withdrawEarnings:  '/v1/blockchain/withdraw-earnings',
    createUserAccount: '/v1/blockchain/create-user-account',
  },
  platform: {
    config: '/v1/platform/config',
  },
}
