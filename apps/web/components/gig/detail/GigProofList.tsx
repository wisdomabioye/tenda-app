/**
 * What the worker will have to hand over (comp lines 623-637).
 *
 * On the PUBLIC page on purpose: the requirement is carried on the summary
 * too, because discovering it after accepting is a bait-and-switch (shared
 * GigSummary doc). An empty requirement list is legal and means "any
 * evidence" — the state every gig had before the field existed — so it says
 * that rather than rendering an empty section.
 */
import { PROOF_TYPE_LABEL, type ProofType } from '@tenda/shared'
import { AlignLeft, Braces, FileText, Image, MapPin, Video } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { GIG_DETAIL_COPY } from './copy'

const PROOF_ICONS: Record<ProofType, LucideIcon> = {
  image: Image,
  video: Video,
  document: FileText,
  geotag: MapPin,
  text: AlignLeft,
  structured: Braces,
}

export function GigProofList({ requirements }: { requirements: readonly ProofType[] }) {
  return (
    <ul className="flex max-w-[60ch] list-none flex-col gap-3 p-0">
      {requirements.length === 0 ? (
        // Still a list item: "any evidence" is the requirement, not the
        // absence of the section, and an <li> outside a <ul> is invalid.
        <ProofItem
          Icon={FileText}
          title={GIG_DETAIL_COPY.proofAnyTitle}
          hint={GIG_DETAIL_COPY.proofAnyHint}
        />
      ) : (
        requirements.map((type) => (
          <ProofItem
            key={type}
            Icon={PROOF_ICONS[type]}
            title={PROOF_TYPE_LABEL[type]}
            hint={GIG_DETAIL_COPY.proofHint[type]}
          />
        ))
      )}
    </ul>
  )
}

function ProofItem({
  Icon,
  title,
  hint,
}: {
  Icon: LucideIcon
  title: string
  hint: string
}) {
  return (
    <li className="flex list-none items-start gap-3.5 rounded-md border border-border-subtle bg-surface-card p-4">
      <Icon size={18} aria-hidden className="mt-0.5 shrink-0 text-content-secondary" />
      <div>
        <p className="font-semibold text-content-primary">{title}</p>
        <p className="mt-0.5 text-[13px] leading-[18px] text-content-secondary">{hint}</p>
      </div>
    </li>
  )
}
