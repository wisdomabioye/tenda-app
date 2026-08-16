'use client'

/**
 * The workspace's 380px list column (Tier 2 comp, lines 388-484). Generic over
 * the row type: it owns the header, the three async states, grouping, keyboard
 * cursor and scrolling — never what a row looks like. Row rendering belongs to
 * the ListRow family, so a new surface reuses this untouched.
 */
import { useId, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { LIST_KEYBOARD_HINT } from './copy'
import { ListEmpty, ListError, ListSkeleton } from './ListStates'
import { ListHeader } from './ListHeader'
import { useListKeyboard } from '@/hooks/workspace/useListKeyboard'
import type { ListColumnProps } from './list.types'

export function ListColumn<TRow>({
  copy,
  groups,
  keyOf,
  hrefOf,
  renderRow,
  isLoading = false,
  error = null,
  countLabel,
  tabs,
  onOpenPalette,
  skeletonRows,
}: ListColumnProps<TRow>) {
  const router = useRouter()
  const titleId = useId()

  // Flattened once per change so the keyboard cursor indexes rows, not
  // groups — the cursor must cross group boundaries as one run.
  const flat = useMemo(() => groups.flatMap((group) => group.rows), [groups])

  const { activeIndex, setActiveIndex, activeRowRef } = useListKeyboard({
    count: flat.length,
    // Enabled only while real rows are on screen: keystrokes during a
    // skeleton or an error would move an invisible cursor.
    enabled: !isLoading && error === null && flat.length > 0,
    onOpen: (index) => {
      const row = flat[index]
      if (row !== undefined) router.push(hrefOf(row))
    },
  })

  // Where each group starts in the flat run, so a row's cursor index is pure
  // arithmetic rather than a counter mutated while rendering.
  const groupOffsets = useMemo(
    () =>
      groups.map((_, index) =>
        groups.slice(0, index).reduce((sum, group) => sum + group.rows.length, 0),
      ),
    [groups],
  )

  const showList = !isLoading && error === null && flat.length > 0
  const showEmpty = !isLoading && error === null && flat.length === 0

  return (
    <section
      data-list
      aria-labelledby={titleId}
      className="flex min-h-0 min-w-0 flex-col border-r border-border-subtle bg-surface-background"
    >
      <ListHeader
        title={copy.title}
        titleId={titleId}
        countLabel={countLabel}
        tabs={tabs}
        onOpenPalette={onOpenPalette}
      />

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading && <ListSkeleton rows={skeletonRows} />}
        {!isLoading && error !== null && <ListError code={error} />}
        {showEmpty && <ListEmpty title={copy.emptyTitle} body={copy.emptyBody} />}

        {showList && (
          <div>
            {groups.map((group, groupIndex) => (
              <div key={group.key} className="mb-2">
                {group.label !== undefined && group.label !== '' && (
                  <p className="mx-3 mb-1.5 mt-3 font-numeric text-[11px] font-bold uppercase leading-4 tracking-[0.13em] text-content-tertiary">
                    {group.label}
                  </p>
                )}
                <ul className="flex flex-col gap-1">
                  {group.rows.map((row, rowIndex) => {
                    const index = groupOffsets[groupIndex] + rowIndex
                    const active = index === activeIndex
                    return (
                      <li
                        key={keyOf(row)}
                        ref={active ? activeRowRef : undefined}
                        // Pointer users get the same cursor as keyboard users,
                        // so the two never disagree about "current".
                        onMouseEnter={() => setActiveIndex(index)}
                      >
                        {renderRow(row, { active })}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
            <p className="m-3 text-xs leading-[18px] text-content-tertiary">
              {LIST_KEYBOARD_HINT.move.map((key) => (
                <Key key={key} label={key} />
              ))}{' '}
              move · <Key label={LIST_KEYBOARD_HINT.open} /> open · {LIST_KEYBOARD_HINT.suffix}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function Key({ label }: { label: string }) {
  return (
    <kbd className="mr-1 rounded-[5px] border border-border-default bg-surface-inset px-1.5 py-px font-numeric text-[11px]">
      {label}
    </kbd>
  )
}
