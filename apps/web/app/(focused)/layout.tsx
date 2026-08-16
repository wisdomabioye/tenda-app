import type { ReactNode } from 'react'

/**
 * Focused shell — no rail, no site chrome (spec-correction #6).
 *
 * The comps give Auth and the Post Wizard their own surface at 640–1000px:
 * both are single-task flows where the rail's other destinations are a way to
 * lose your place mid-flow. Verified by the comps themselves — `Tenda Auth`
 * and `Tenda Post Wizard` are the two files with no 64px rail.
 *
 * Route groups do not affect URLs, so /signin and /post are unchanged.
 */
export default function FocusedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-background">
      <main className="mx-auto w-full max-w-[1000px] flex-1 px-4 py-6">{children}</main>
    </div>
  )
}
