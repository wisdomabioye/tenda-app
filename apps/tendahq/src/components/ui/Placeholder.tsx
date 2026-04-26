import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Tracking issue id, e.g. "M75". Goes to data-issue for grep / audit. */
  issue: string
  className?: string
}

/**
 * Wraps a string of text whose source-of-truth backend doesn't exist yet.
 * Renders identically to a plain span; the dev outline (see index.css
 * `[data-placeholder='true']`) makes every site grep-able.
 *
 * Production audit: `grep -rn 'data-placeholder="true"' apps/tendahq/dist`
 * should return zero hits before public launch (per LANDING_TODO.md M82).
 */
export function Placeholder({ children, issue, className }: Props) {
  return (
    <span data-placeholder="true" data-issue={issue} className={className}>
      {children}
    </span>
  )
}
