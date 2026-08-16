'use client'

/**
 * The three-pane workspace: rail | list | detail (Tier 2 comp, line 362).
 *
 * The grid geometry and the ≤1100/≤900px collapse live in app/globals.css
 * under [data-panes] — they are parent-state descendant rules, and keeping
 * them in CSS means the server and client agree without measuring anything.
 * This component's whole job is to render the panes and say whether a detail
 * is selected.
 *
 * It does NOT own the socket or the realtime mirrors: those belong to the
 * layout that owns the authed session (#6), so they survive a pane swapping
 * its contents.
 */
import type { ReactNode } from 'react'
import type { User } from '@tenda/shared'
import { Rail } from './rail'

export interface WorkspaceShellProps {
  user: User | null
  /** The 380px column. Omit on surfaces the comps render without a list. */
  list?: ReactNode
  /** The flexible pane. When absent, the shell collapses to the list at ≤900px. */
  detail?: ReactNode
}

/**
 * React renders nothing for null, undefined and booleans — so a pane holding
 * one is not a pane. This matters because `detail={selected && <Detail />}` is
 * the idiomatic way to write a conditional pane, and it yields `false`, not
 * `undefined`: treating that as "a detail exists" hides the list at ≤900px and
 * leaves the reader staring at a blank column.
 */
function hasPane(node: ReactNode): boolean {
  return node !== undefined && node !== null && typeof node !== 'boolean'
}

export function WorkspaceShell({ user, list, detail }: WorkspaceShellProps) {
  const hasDetail = hasPane(detail)
  const hasList = hasPane(list)

  return (
    <div
      data-panes
      // Presence, not a value: React drops the attribute when undefined, and
      // the CSS keys off these existing at all.
      data-nodetail={hasDetail ? undefined : ''}
      data-nolist={hasList ? undefined : ''}
      className="bg-surface-background"
    >
      <Rail user={user} />
      {list}
      {detail}
    </div>
  )
}
