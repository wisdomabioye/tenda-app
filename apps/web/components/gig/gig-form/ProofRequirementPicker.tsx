'use client'

/**
 * Proof types the worker must attach before they can submit — web twin of
 * mobile's gig-form/ProofRequirementPicker. Optional — no selection keeps
 * the pre-existing behaviour where any evidence is accepted. The selection
 * is normalised on every change so the stored order matches the server's.
 */
import {
  FILE_PROOF_TYPES,
  PROOF_TYPE_LABEL,
  normaliseProofRequirements,
  type ProofType,
} from '@tenda/shared'
import { Chip } from '@/components/ui/Chip'

// FILE types only, deliberately not the whole PROOF_TYPES vocabulary — same
// rule and reason as mobile's twin: the data types (geotag/text/structured)
// need the #15 params + capture UI; geotag/structured are refused by the
// server without params this form cannot supply, and a required `text` could
// never be satisfied by the file-only upload dialog, stranding the worker.
const PROOF_OPTIONS = FILE_PROOF_TYPES.map((type) => ({ label: PROOF_TYPE_LABEL[type], value: type }))

export function ProofRequirementPicker({
  value,
  onChange,
}: {
  value: ProofType[]
  onChange: (value: ProofType[]) => void
}) {
  function toggle(type: ProofType) {
    const next = value.includes(type) ? value.filter((t) => t !== type) : [...value, type]
    onChange(normaliseProofRequirements(next))
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-content-primary">Required proof</p>
      <p className="-mt-1 text-xs text-content-tertiary">
        Optional. The worker can&apos;t submit until they attach every type you pick.
      </p>
      <div className="flex flex-wrap gap-2">
        {PROOF_OPTIONS.map((o) => (
          <Chip key={o.value} label={o.label} selected={value.includes(o.value)} onClick={() => toggle(o.value)} />
        ))}
      </div>
    </div>
  )
}
