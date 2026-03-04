export const APP_INFO = {
  name: 'Tenda',
  tagline: 'Freelance work, paid on-chain',

  fees: {
    platformFeePct: 2.5, // percentage shown in support screens — update when rate is confirmed
  },

  support: {
    whatsapp: 'https://wa.me/2348012345678',
    email: 'support@tenda.com',
  },

  legal: {
    terms: 'https://tenda.com/terms',
    privacy: 'https://tenda.com/privacy',
  },

  social: {
    twitter: 'https://twitter.com/tendaapp',
    instagram: 'https://instagram.com/tendaapp',
  },

  external: {
    website: 'https://tenda.com',
    tendaPlayStore: 'https://play.google.com/store/apps/details?id=com.tenda.app',
  },

  wallets: {
    phantom: {
      name: 'Phantom',
      playStore: 'https://play.google.com/store/apps/details?id=app.phantom',
    },
    solflare: {
      name: 'Solflare',
      playStore: 'https://play.google.com/store/apps/details?id=com.solflare.mobile',
    },
  },
} as const
