/**
 * A ruled section on the gig detail — eyebrow heading, hairline above, one
 * rhythm. Four of them in the comp (brief, terms, proof, posted by), all
 * identical apart from their contents.
 */
import type { ReactNode } from 'react'
import { Eyebrow } from '@/components/ui'

export function GigDetailSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="mt-5 rounded-card border border-border-subtle bg-surface-card p-5 shadow-sm sm:p-6">
      <Eyebrow as="h2" className="mb-4">
        {title}
      </Eyebrow>
      {children}
    </section>
  )
}
