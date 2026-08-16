'use client'

/**
 * Fire-and-forget toast layer (mobile's showToast convention). A module-level
 * queue + one <ToastHost/> in the ROOT layout (it must cover the public
 * routes too — the gig-detail island toasts on /gig/[id]): `showToast` works
 * from any code (stores, hooks, flows) without a React context, and toasts
 * survive route changes — the funding flow toasts THEN navigates, which an
 * inline notice cannot outlive.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { cn } from '@/lib/cn'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastEntry {
  id: number
  type: ToastType
  message: string
}

const DISMISS_MS = 4_000
const MAX_VISIBLE = 3

let nextId = 1
let toasts: ToastEntry[] = []
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function showToast(type: ToastType, message: string): void {
  toasts = [...toasts, { id: nextId++, type, message }].slice(-MAX_VISIBLE)
  emit()
}

function dismiss(id: number): void {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test seam. */
export function clearToastsForTests(): void {
  toasts = []
  emit()
}

/**
 * The comps draw ONE neutral inverse pill for every toast. Kept that surface,
 * but not the flattening: a success and a failure that look identical make
 * the reader parse the sentence to learn which happened. The type shows as a
 * coloured leading edge on the comps' inverse card — their look, without
 * discarding the signal.
 */
const TONE: Record<ToastType, string> = {
  success: 'border-l-4 border-l-feedback-success-base',
  error: 'border-l-4 border-l-feedback-danger-base',
  info: '',
}

function ToastItem({ toast }: { toast: ToastEntry }) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), DISMISS_MS)
    return () => clearTimeout(timer)
  }, [toast.id])

  return (
    <button
      type="button"
      role="status"
      onClick={() => dismiss(toast.id)}
      className={cn(
        'animate-popin pointer-events-auto w-full max-w-sm rounded-control bg-surface-inverse px-5 py-3 text-left text-sm font-semibold text-content-inverse shadow-elevated',
        TONE[toast.type],
      )}
    >
      {toast.message}
    </button>
  )
}

const EMPTY: ToastEntry[] = []

/** Mount ONCE (root layout). Renders the live queue bottom-center. */
export function ToastHost() {
  // The server snapshot is a stable EMPTY list: SSR/hydration render null,
  // and the first client subscription swap brings in any live queue — no
  // mounted-flag effect needed.
  const entries = useSyncExternalStore(subscribe, () => toasts, () => EMPTY)
  if (entries.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4">
      {entries.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
