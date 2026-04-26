import { APP_INFO } from '@/app-info'

export const STILL_QUESTIONS = {
  title: 'Still have a question?',
  body: 'Real humans on the other side. Most answers in under 4h. Anything technical → docs. Anything broken → support.',
  links: [
    { label: 'WhatsApp community', href: APP_INFO.whatsappUrl },
    { label: 'X · @tendahq',       href: APP_INFO.twitterUrl  },
    { label: 'Telegram',           href: APP_INFO.telegramUrl },
  ],
} as const
