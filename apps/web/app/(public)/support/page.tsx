/**
 * Help & Guide index — public, server-rendered (S6.6: the cheapest SEO in
 * the plan). Topics come from shared SUPPORT_TOPICS; web maps slug→route.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { SUPPORT_TOPICS, APP_INFO } from '@tenda/shared'

export const metadata: Metadata = {
  title: `Help & Guide · ${APP_INFO.name}`,
  description: 'How Tenda escrow, gigs, wallets and payouts work.',
}

export default function SupportIndexPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-8">
      <h1 className="font-display text-3xl font-bold text-content-primary">Help &amp; Guide</h1>
      {SUPPORT_TOPICS.map((topic) => (
        <Link
          key={topic.slug}
          href={`/support/${topic.slug}`}
          className="rounded-card border border-border-subtle bg-surface-card px-4 py-3 transition-colors hover:bg-surface-inset"
        >
          <p className="text-sm font-semibold text-content-primary">{topic.title}</p>
          <p className="text-xs text-content-secondary">{topic.description}</p>
        </Link>
      ))}
    </div>
  )
}
