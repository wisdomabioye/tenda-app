/**
 * A JSON body, formatted, scrollable in its own box, and collapsed when it is
 * long enough to bury the page.
 *
 * The recorded 402 is the most important sample on the site and also the
 * longest — its EIP-712 `typed_data` alone runs past a screen, so shown whole
 * it pushes every other response out of sight. It opens at a readable height
 * with the line count on the control, because the size of that envelope is
 * itself something a reader should know before signing it.
 *
 * `overflow-x: auto` on the block, never on the page: an escrow id or a
 * signature is wider than any column, and a body that widened the page would
 * push the whole reference sideways.
 */
import { useMemo, useState } from 'react'
import type { ExampleValue } from '@tenda/api-doc'

/** Longer than this and a body opens collapsed. Twelve lines shows the shape. */
export const COLLAPSE_OVER_LINES = 12

export function CodeBlock({ value, label }: { value: ExampleValue; label?: string }) {
  const text = useMemo(() => JSON.stringify(value, null, 2), [value])
  const lines = useMemo(() => text.split('\n').length, [text])
  const collapsible = lines > COLLAPSE_OVER_LINES
  const [open, setOpen] = useState(false)
  const collapsed = collapsible && !open

  return (
    <div className="overflow-hidden rounded-[var(--radius-sm)] border" style={{ borderColor: 'var(--border-default)' }}>
      {label !== undefined && (
        <div
          className="flex items-center justify-between gap-3 border-b px-3 py-1.5"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-inset)' }}
        >
          <span
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.9px]"
            style={{ color: 'var(--content-tertiary)' }}
          >
            {label}
          </span>
          {collapsible && (
            <button
              type="button"
              onClick={() => { setOpen(!open) }}
              className="font-mono text-[10px] font-semibold"
              style={{ color: 'var(--content-link)' }}
            >
              {open ? 'Collapse' : `Show all ${lines} lines`}
            </button>
          )}
        </div>
      )}
      <pre
        className="m-0 overflow-x-auto px-3 py-2.5 font-mono text-[11.5px] leading-[1.65]"
        style={{
          background: 'var(--surface-card)',
          color: 'var(--content-primary)',
          maxHeight: collapsed ? `${COLLAPSE_OVER_LINES * 1.65}em` : undefined,
          overflowY: collapsed ? 'hidden' : undefined,
          // A fade rather than a hard cut, so it reads as "there is more".
          maskImage: collapsed ? 'linear-gradient(to bottom, black 72%, transparent)' : undefined,
        }}
      >
        <code>{text}</code>
      </pre>
    </div>
  )
}
