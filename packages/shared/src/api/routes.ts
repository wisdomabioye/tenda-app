import type { ApiContract } from './contracts'

export const apiRoutes: {
  [K in keyof ApiContract]: { [A in keyof ApiContract[K]]: string }
} = {
  auth: {
    nonce: '/v1/auth/nonce',
    wallet: '/v1/auth/wallet',
    me: '/v1/auth/me',
    sendPhoneOtp: '/v1/auth/send-phone-otp',
    verifyPhoneOtp: '/v1/auth/verify-phone-otp',
    linkWallet: '/v1/auth/link-wallet',
    unlinkWallet: '/v1/auth/unlink-wallet',
    setPrimaryWallet: '/v1/auth/set-primary-wallet',
  },
  escrows: {
    create: '/v1/escrows',
    accept: '/v1/escrows/:id/accept',
    decline: '/v1/escrows/:id/decline',
    submit: '/v1/escrows/:id/submit',
    approve: '/v1/escrows/:id/approve',
    claim: '/v1/escrows/:id/claim',
    cancel: '/v1/escrows/:id/cancel',
    refund: '/v1/escrows/:id/refund',
    dispute: '/v1/escrows/:id/dispute',
    disputeMessages: '/v1/escrows/:id/dispute/messages',
    sendDisputeMessage: '/v1/escrows/:id/dispute/messages',
    resolve: '/v1/escrows/:id/resolve',
    delete: '/v1/escrows/:id',
    proofs: '/v1/escrows/:id/proofs',
    addProofs: '/v1/escrows/:id/proofs',
    review: '/v1/escrows/:id/review',
  },
  gigs: {
    list: '/v1/gigs',
    featured: '/v1/gigs/featured',
    create: '/v1/gigs',
    get: '/v1/gigs/:id',
  },
  users: {
    me: '/v1/users/me',
    updateMe: '/v1/users/me',
    myStanding: '/v1/users/me/standing',
    standing: '/v1/users/:id/standing',
    get: '/v1/users/:id',
    update: '/v1/users/:id',
    escrows: '/v1/users/:id/escrows',
    reviews: '/v1/users/:id/reviews',
    transactions: '/v1/users/:id/transactions',
  },
  upload: {
    signature: '/v1/upload/signature',
  },
  moderation: {
    preview: '/v1/moderation/preview',
  },
  fiat: {
    quote: '/v1/fiat/quote',
    onramp: '/v1/fiat/onramp',
    offramp: '/v1/fiat/offramp',
    intent: '/v1/fiat/intents/:id',
    cancelIntent: '/v1/fiat/intents/:id/cancel',
    bankAccounts: '/v1/bank-accounts',
    createBankAccount: '/v1/bank-accounts',
    deleteBankAccount: '/v1/bank-accounts/:id',
  },
  blockchain: {
    clientPing: '/v1/blockchain/transaction',
  },
  platform: {
    config:        '/v1/platform/config',
    exchangeRates: '/v1/platform/exchange-rates',
  },
  conversations: {
    list:         '/v1/conversations',
    findOrCreate: '/v1/conversations',
    messages:     '/v1/conversations/:id/messages',
    sendMessage:  '/v1/conversations/:id/messages',
    close:        '/v1/conversations/:id/close',
  },
  notifications: {
    registerToken: '/v1/notifications/device-token',
  },
  subscriptions: {
    list:   '/v1/subscriptions',
    upsert: '/v1/subscriptions',
    remove: '/v1/subscriptions/:id',
  },
  reports: {
    create: '/v1/reports',
  },
  exchange: {
    list: '/v1/exchange',
    get: '/v1/exchange/:id',
  },
}
