import { APP_INFO } from '@/content'

/**
 * No response-time number here on purpose. "Most answers in under 4h" was an
 * unbacked SLA of the same kind as the "≤ 24h" dispute promise this audit
 * removed from §04 — nothing measures it, and the first person who waits five
 * hours has been told something untrue by the page.
 */
export const STILL_QUESTIONS = {
  title: 'Still have a question?',
  body: 'Real humans on the other side, and a real person answers. Ask on X or Telegram — technical, commercial, or something looks broken.',
  links: [
    { label: 'X · @tendahq', href: APP_INFO.twitterUrl  },
    { label: 'Telegram',     href: APP_INFO.telegramUrl },
  ],
} as const
