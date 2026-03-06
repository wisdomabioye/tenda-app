export const APP_INFO = {
  name: 'Tenda',
  tagline: 'Freelance work, paid on-chain',

  fees: {
    platformFeePct: 2.5, // percentage shown in support screens
  },

  support: {
    whatsapp: 'https://chat.whatsapp.com/EeB5OMalNy0EbMlU4QPZMr?mode=hq2tcli',
    email: 'support@usetenda.com',
  },

  legal: {
    terms: 'https://usetenda.com/terms',
    privacy: 'https://usetenda.com/privacy',
  },

  social: {
    twitter: 'https://x.com/usetenda',
    instagram: 'https://instagram.com/usetenda',
  },

  external: {
    website: 'https://usetenda.com',
    tendaPlayStore: 'https://play.google.com/store/apps/details?id=com.usetenda.app',
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
