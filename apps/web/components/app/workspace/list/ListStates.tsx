/**
 * The list column's three mutually exclusive async states. Copy that differs
 * per surface arrives as props; only the shared error wording is fixed (see
 * ./copy.ts).
 */
import { Inbox } from 'lucide-react'
import { LIST_ERROR_COPY, LIST_SKELETON_ROWS } from './copy'

export function ListSkeleton({ rows = LIST_SKELETON_ROWS }: { rows?: number }) {
  return (
    <div aria-hidden className="animate-shimmer flex flex-col gap-3.5 p-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="rounded-card border border-border-subtle bg-surface-card p-3.5">
          <div className="h-3 w-[34%] rounded-md bg-surface-inset" />
          <div className="mt-3 h-4 w-[86%] rounded-md bg-surface-inset" />
          <div className="mt-2.5 h-3 w-[52%] rounded-md bg-surface-inset" />
        </div>
      ))}
    </div>
  )
}

export function ListError({ code }: { code?: string | null }) {
  return (
    <div
      role="alert"
      className="m-2 rounded-card border border-feedback-danger-border bg-feedback-danger-surface p-4.5"
    >
      <p className="text-[15px] font-bold leading-[22px] text-feedback-danger-text">
        {LIST_ERROR_COPY.title}
      </p>
      <p className="mt-1.5 text-[13px] leading-[18px] text-feedback-danger-text opacity-85">
        {LIST_ERROR_COPY.body}
      </p>
      {code !== undefined && code !== null && code !== '' && (
        <p className="mt-1.5 font-numeric text-xs text-feedback-danger-text opacity-70">{code}</p>
      )}
    </div>
  )
}

export function ListEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="m-2 rounded-card border border-dashed border-border-strong px-5 py-9 text-center">
      <Inbox size={22} aria-hidden className="mx-auto text-content-tertiary" />
      <p className="mt-3 font-display text-[17px] font-semibold leading-6 text-content-primary">
        {title}
      </p>
      <p className="mx-auto mt-1.5 max-w-[32ch] text-[13px] leading-[18px] text-content-secondary">
        {body}
      </p>
    </div>
  )
}
