/**
 * Sentences for the proof-upload sheet.
 *
 * Product facts come from `@tenda/shared` — this only phrases them, and where
 * shared already owns the phrasing of a fact it calls into it rather than
 * restating it, so one requirement never reaches a worker in two voices.
 *
 * apps/web's `components/gig/detail/copy.ts` holds the same block as
 * `PROOF_DIALOG_COPY`. Keep the wording in step; promoting it to shared is the
 * obvious next move and was left out of scope here.
 */
import { formatProofTypeList, normaliseProofRequirements, type ProofType } from '@tenda/shared'

export const PROOF_SHEET_COPY = {
  /**
   * What the escrow ALREADY holds, on the retry screen. Without it the retry
   * is an empty form with an enabled button, and the worker has no way to know
   * the files they uploaded a minute ago survived the failed transaction.
   *
   * Takes the stored proof ROWS, which repeat by type — three photos is an
   * ordinary batch. So the types are deduplicated (through the shared
   * normaliser, which also fixes their order) and the COUNT carries the rest;
   * listing per row read "Photo, Photo, Photo". The plural follows the file
   * count, not the type count, for the same reason.
   */
  alreadyAttached: (types: readonly ProofType[]) => {
    const one = types.length === 1
    return (
      `Already uploaded to this escrow: ${types.length} ${one ? 'file' : 'files'} ` +
      `(${formatProofTypeList(normaliseProofRequirements(types))}). ` +
      `Submitting again reuses ${one ? 'it' : 'them'} — you only need to attach ` +
      `something new if you want to add to the evidence.`
    )
  },
} as const
