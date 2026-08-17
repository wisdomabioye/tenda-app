import type { ReactNode } from 'react'

/**
 * The support pages' measure. The public shell deliberately applies none (its
 * pages are full-bleed sections that centre their own content), and these
 * articles are prose — they need a narrower column than the feed, not the
 * full 1240px.
 *
 * Here rather than repeated in six page files, and separate from those pages
 * so the Tier-1 support port can restyle the whole section in one place.
 */
export default function SupportLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl px-4 py-5">{children}</div>
}
