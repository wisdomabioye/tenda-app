import type { ReactNode } from 'react'

/** One tab in the list header, with its own count. */
export interface ListTab {
  href: string
  label: string
  /** Rendered beside the label in tabular numerals; omit when unknown. */
  count?: number
  current?: boolean
}

/**
 * A run of rows under an optional heading — the comps' day-grouping and any
 * other sectioning a surface needs. A group without a label renders its rows
 * ungrouped, so a flat list is just one unlabelled group.
 */
export interface ListGroup<TRow> {
  key: string
  label?: string
  rows: readonly TRow[]
}

/** The strings that differ per surface. */
export interface ListSurfaceCopy {
  /** The column heading, and the list's accessible name. */
  title: string
  emptyTitle: string
  emptyBody: string
}

export interface ListColumnProps<TRow> {
  copy: ListSurfaceCopy
  groups: readonly ListGroup<TRow>[]
  /** Stable identity per row — also the React key. */
  keyOf: (row: TRow) => string
  /** Where Enter (and a click) takes this row. */
  hrefOf: (row: TRow) => string
  renderRow: (row: TRow, state: { active: boolean }) => ReactNode
  isLoading?: boolean
  error?: string | null
  /** Monospace count line under the title, e.g. "12 open". */
  countLabel?: string
  tabs?: readonly ListTab[]
  /** Opens the command palette; the ⌘K button is hidden when absent. */
  onOpenPalette?: () => void
  skeletonRows?: number
}
