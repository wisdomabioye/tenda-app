/**
 * One labelled block in the filter rail. Five of them in the comp, all the
 * same shape: an eyebrow label, then the control.
 *
 * `htmlFor` turns the eyebrow into a real <label> for the two blocks that
 * wrap a single form control (search, sort) and leaves it a plain heading for
 * the three that wrap a GROUP of controls — a label pointing at a group of
 * links is invalid, and screen readers announce it as belonging to whichever
 * control it happens to reach first.
 */
import type { ReactNode } from 'react'
import { Eyebrow } from '@/components/ui'

export function RailSection({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div>
      {htmlFor === undefined ? (
        <Eyebrow className="mb-2.5">{label}</Eyebrow>
      ) : (
        <Eyebrow as="label" htmlFor={htmlFor} className="mb-2.5 block">
          {label}
        </Eyebrow>
      )}
      {children}
    </div>
  )
}
