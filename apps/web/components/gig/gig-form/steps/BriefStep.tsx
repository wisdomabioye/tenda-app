'use client'

/** Step 2 — the words a stranger has to work from. */
import { DESC_MAX, TITLE_MAX } from '@tenda/shared'
import { controlClassName } from '@/components/ui/TextField'
import { CharCounter, FieldNote } from './parts'
import type { GigFormController } from '@/hooks/gig/useGigForm'

export function BriefStep({ form }: { form: GigFormController }) {
  return (
    <div className="mt-7 flex max-w-[640px] flex-col gap-6">
      <label className="flex flex-col gap-2.5 font-numeric text-xs font-medium uppercase tracking-[0.13em] text-content-tertiary">
        Title
        <input
          className={controlClassName}
          placeholder="Same-day delivery of 12 boxes across Lekki"
          value={form.title}
          maxLength={TITLE_MAX}
          onChange={(e) => form.setTitle(e.target.value)}
        />
        <span className="flex justify-between gap-3 normal-case tracking-normal">
          <FieldNote>Say what, where and when. This is the line people scan.</FieldNote>
          <CharCounter value={form.title} max={TITLE_MAX} />
        </span>
      </label>

      <label className="flex flex-col gap-2.5 font-numeric text-xs font-medium uppercase tracking-[0.13em] text-content-tertiary">
        The brief
        <textarea
          rows={7}
          className={`${controlClassName} resize-y`}
          placeholder="Addresses, hours, constraints, and what would count as done."
          value={form.description}
          maxLength={DESC_MAX}
          onChange={(e) => form.setDescription(e.target.value)}
        />
        <span className="flex justify-between gap-3 normal-case tracking-normal">
          <FieldNote>{form.descriptionHint}</FieldNote>
          <CharCounter value={form.description} max={DESC_MAX} />
        </span>
      </label>
    </div>
  )
}
