import type { ReactNode } from 'react'
import { SiteHeader } from '@/components/public/SiteHeader'
import { SiteFooter } from '@/components/public/SiteFooter'

/** Tier-1 shell: header + footer, no app chrome (see CLAUDE.md, source-of-truth notes). */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">{children}</main>
      <SiteFooter />
    </div>
  )
}
