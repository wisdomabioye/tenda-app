import {
  FILE_PROOF_TYPES,
  PROOF_TYPE_LABEL,
  normaliseProofRequirements,
  type ProofType,
} from '@tenda/shared'
import { ChipGroup, type ChipOption } from '@/components/ui/ChipGroup'

// FILE types only, deliberately not the whole PROOF_TYPES vocabulary: the
// data types (geotag/text/structured) need the params + capture UI (#15) —
// geotag/structured are refused by the server without params this form
// cannot supply, and a required `text` could never be satisfied by the
// file-only submit sheet, stranding the worker.
const OPTIONS: readonly ChipOption<ProofType>[] = FILE_PROOF_TYPES.map((type) => ({
  label: PROOF_TYPE_LABEL[type],
  value: type,
}))

/**
 * Proof types the worker must attach before they can submit. Optional — no
 * selection keeps the pre-existing behaviour where any evidence is accepted.
 *
 * The selection is normalised on every change so the stored order matches the
 * server's, and picking video-then-photo is indistinguishable from
 * photo-then-video.
 */
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
    <ChipGroup
      label="Required proof"
      hint="Optional. The worker can't submit until they attach every type you pick."
      options={OPTIONS}
      isSelected={(type) => value.includes(type)}
      onPress={toggle}
    />
  )
}
