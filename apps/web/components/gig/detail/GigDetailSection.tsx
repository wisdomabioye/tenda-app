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
    <section className="mt-10 border-t border-border-subtle pt-8">
      <Eyebrow as="h2" className="mb-5">
        {title}
      </Eyebrow>
      {children}
    </section>
  )
}
