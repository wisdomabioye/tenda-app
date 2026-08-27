/**
 * What the product SAYS about proof — the sentences both clients show a worker
 * about what a gig requires, what is still missing, and what the escrow already
 * holds.
 *
 * Shared for the same reason `formatProofTypeList` is (see its doc): the server
 * refuses with "This gig requires photo and video proof…", and a client that
 * words the same requirement differently tells one worker the same fact two
 * ways in the same minute. These call into that formatter rather than
 * restating it, so the vocabulary has exactly one owner.
 *
 * What does NOT live here is anything a client's own CONTROLS say — web's
 * "Uploading…"/"Submitting…" button label has no mobile twin on purpose
 * (mobile's Button hides its label behind a spinner), and a label about one
 * client's button is not a product fact.
 */
import { formatProofTypeList, normaliseProofRequirements, type ProofType } from './proofs'

export const PROOF_COPY = {
  /** The poster's declared requirement. */
  required: (types: readonly ProofType[]) => `Required proof: ${formatProofTypeList(types)}`,
  /** What is still outstanding, once something has been attached. */
  stillNeeded: (types: readonly ProofType[]) => `Still needed: ${formatProofTypeList(types)}`,
  /** Every declared type is covered. */
  allCovered: 'All required proof attached',
  /**
   * Shown BEFORE anything is attached — the pre-accept case, where the worker
   * is being told what accepting will commit them to rather than what is
   * missing from an upload they have started.
   */
  attachBeforeSubmit: "You'll need to attach this before you can submit the work.",
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

/**
 * The requirement and its status as ONE paragraph, for a surface that renders
 * them together rather than as separate lines. The punctuation lives here
 * rather than in a client's markup, so joining them cannot become the place
 * the two clients diverge again.
 */
export function proofRequirementLine(
  required: readonly ProofType[],
  missing: readonly ProofType[],
): string {
  const status = missing.length > 0 ? PROOF_COPY.stillNeeded(missing) : PROOF_COPY.allCovered
  return `${PROOF_COPY.required(required)}. ${status}.`
}
