import { APP_INFO } from '@/app-info'

export type SocialKey = 'whatsapp' | 'twitter' | 'telegram'

export interface SocialLink {
  key: SocialKey
  label: string
  href: string
}

/**
 * Footer socials — icon-only anchors. Order matters (left → right).
 * Icons themselves live in `<FooterSocial />` so this file stays declarative.
 */
export const FOOTER_SOCIALS: readonly SocialLink[] = [
  { key: 'whatsapp', label: 'WhatsApp', href: APP_INFO.whatsappUrl },
  { key: 'twitter',  label: 'X',        href: APP_INFO.twitterUrl  },
  { key: 'telegram', label: 'Telegram', href: APP_INFO.telegramUrl },
] as const
