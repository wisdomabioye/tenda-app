export const APP_INFO = {
  name: 'Tenda',
  tagline: 'Get paid. No middlemen.',
  description: 'Post or accept gigs with instant on-chain escrow. Proof required. Payment guaranteed.',
  apkUrl: 'https://github.com/wisdomabioye/tenda-app/releases/download/0.1.1-devnet/v0.1.1-devnet.apk',
  appStoreUrl: '#',
  playStoreUrl: '#',
  twitterUrl: 'https://x.com/tendahq',
  whatsappUrl: 'https://chat.whatsapp.com/EeB5OMalNy0EbMlU4QPZMr?mode=hq2tcli',
  discordUrl: '#',
  githubUrl: '#',
  telegramUrl: '#',

  stats: [
    { value: '< 2s', label: 'Escrow locked' },
    { value: '2.5%', label: 'Platform fee' },
    { value: '100%', label: 'On-chain' },
    { value: 'Solana', label: 'Powered by' },
  ],

  howItWorksEarn: [
    { step: 1, title: 'Browse open gigs', description: 'Filter by city and category to find gigs near you.' },
    { step: 2, title: 'Accept & complete', description: 'Accept the gig, do the work, then submit photo or video proof.' },
    { step: 3, title: 'Get paid instantly', description: 'Poster approves your proof and SOL lands in your wallet.' },
  ],

  howItWorksPost: [
    { step: 1, title: 'Post a gig', description: 'Describe the task, set your price, and publish — SOL locks automatically.' },
    { step: 2, title: 'Worker accepts', description: 'A verified worker accepts and completes the gig.' },
    { step: 3, title: 'Review & release', description: 'Review their proof, approve, and payment is released from escrow.' },
  ],
}
