import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { COPY_LABELS } from './content'

interface Props {
  chainId: string
}

/**
 * Copies a CAIP-2 chain id to the clipboard, confirming for a moment.
 *
 * The timeout is CLEARED on unmount and before each restart. Without that, a
 * visitor who copies and scrolls away leaves a timer holding a setState on an
 * unmounted component, and a double-click leaves two racing timers where the
 * first one to fire clears the confirmation the second is still showing.
 *
 * A failed copy leaves the label alone rather than reporting success:
 * `navigator.clipboard` rejects on an insecure origin and is absent entirely
 * in some in-app browsers, which is exactly where a silent lie would land.
 */
export function CopyChainId({ chainId }: Props) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current)
  }, [])

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(chainId)
    } catch {
      return
    }
    setCopied(true)
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1600)
  }, [chainId])

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`${COPY_LABELS.idle} ${chainId}`}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[var(--content-tertiary)] transition-colors hover:bg-[var(--surface-inset)] hover:text-[var(--content-primary)]"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      <span className="caption font-bold uppercase tracking-[0.06em]">
        {copied ? COPY_LABELS.done : COPY_LABELS.idle}
      </span>
    </button>
  )
}
