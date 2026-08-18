'use client'

/**
 * Step 4 — what settles the gig, and who may take it.
 *
 * Neither field can be "missing": an empty proof list means any evidence is
 * accepted (the pre-existing behaviour), and instant acceptance is the
 * default. So this step never blocks the reader — see wizard-steps.
 */
import { AcceptanceModePicker } from '../AcceptanceModePicker'
import { ProofRequirementPicker } from '../ProofRequirementPicker'
import { FieldNote, SectionLabel } from './parts'
import type { GigFormController } from '@/hooks/gig/useGigForm'

export function ProofTakingStep({ form }: { form: GigFormController }) {
  return (
    <div className="mt-7 flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <SectionLabel>Proof that settles it</SectionLabel>
        <ProofRequirementPicker
          value={form.proofRequirements}
          onChange={form.setProofRequirements}
        />
        <FieldNote>
          Ask for what you will actually look at. Three photographs you check beats a video you
          never open.
        </FieldNote>
      </div>

      <div className="flex flex-col gap-3">
        <SectionLabel>Who can take it</SectionLabel>
        <AcceptanceModePicker
          requiresApproval={form.requiresApproval}
          onChange={form.setRequiresApproval}
        />
      </div>
    </div>
  )
}
