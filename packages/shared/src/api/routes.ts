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
    accept: '/v1/gigs/:id/accept',
    submit: '/v1/gigs/:id/submit',
    approve: '/v1/gigs/:id/approve',
    dispute: '/v1/gigs/:id/dispute',
  },
  users: {
    get: '/v1/users/:id',
    update: '/v1/users/:id',
    gigs: '/v1/users/:id/gigs',
  },
  upload: {
    signature: '/v1/upload/signature',
  },
  blockchain: {
    transaction: '/v1/blockchain/transaction/:signature',
    createEscrow: '/v1/blockchain/create-escrow',
  },
}
