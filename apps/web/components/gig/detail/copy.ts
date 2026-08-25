/**
 * The gig-detail folder's strings: the public listing's sentences
 * (`GIG_DETAIL_COPY`, Tier 1 comp lines 547-683) and the proof-upload
 * dialog's (`PROOF_DIALOG_COPY`), which is party-only rather than public.
 *
 * Product facts come from `@tenda/shared`; only sentences live here — and
 * where shared already owns the PHRASING of a fact, the sentence calls into
 * it rather than restating it. The proof block below is why that clause is
 * here: it used to hand-roll a list the shared formatter owns, so the same
 * requirement reached one worker in two different voices.
 */
import {
  formatProofTypeList,
  normaliseProofRequirements,
  type ProofType,
} from '@tenda/shared'

export const GIG_DETAIL_COPY = {
  breadcrumbRoot: 'All gigs',
  brief: 'The brief',
  briefEmpty: 'The poster left no brief. The terms below are the whole agreement.',
  terms: 'Terms of this escrow',
  proof: 'Proof you must submit',
  proofAnyTitle: 'Any evidence',
  proofAnyHint: 'This gig names no required proof type — attach whatever shows the work was done.',
  proofHint: {
    image: 'A clear photo, taken at the place the work happened.',
    video: 'A short clip. Long uploads fail more often than they help.',
    document: 'A receipt, invoice or signed note as a file.',
  },
  postedBy: 'Posted by',
  /** The counterparty card's role line to the CREATOR (party-view.ts pairs it
   *  with `postedBy` for the other seat) — one source for both surfaces that
   *  draw the card. */
  worker: 'Worker',
  /** Label over the viewer-relative bound wallet (`my_signer_address`) —
   *  shared by the public party panel and the workspace dossier so one
   *  escrow names the fact the same way on both surfaces. */
  yourWallet: 'Your escrow wallet',
  postedByNote:
    'Full profiles, message threads and dispute history are visible to signed-in users.',
  noRating: 'No reviews yet',
  ratingCaption: 'out of 5',
  locked: 'Locked in escrow',
  feePending: 'The worker payout is this funded amount minus the platform fee.',
  /** Both figures or neither: `escrowFeeBreakdown` answers all-null until the
   *  config loads, so the caller shows `feePending` instead of calling this. */
  workerReceives: (amount: string, symbol: string, feePct: string) =>
    `Worker receives ${amount} ${symbol} after the ${feePct}% platform fee.`,
  lockedOn: (chain: string) =>
    `Funds were locked on ${chain} before this gig was listed. Neither side can move them alone.`,
  settleTitle: 'How it settles',
  settleLink: 'How escrow works',
  settleSteps: {
    apply: 'You apply, and the poster picks who does the work.',
    accept: 'You accept, and the work is yours the moment you do.',
    rest: [
      'You do the work and submit the proof listed above.',
      'The poster approves, or the approval deadline passes.',
      'Escrow releases the net amount to your wallet.',
    ],
  },
  /** The gig exists as far as we know — we just could not read it. */
  unavailableTitle: 'We could not load this gig',
  unavailableBody:
    'The gig index did not respond. This is a read failure only — no escrow, no balance and no agreement is affected by it.',
  unavailableAction: 'Try again',
  unavailableBrowse: 'Browse open gigs',
  crossBorder: 'Cross-border',
  postedPrefix: 'Posted',
  terminology: {
    payment: 'Payment',
    chain: 'Chain',
    location: 'Location',
    deliverWithin: 'Time to complete',
    acceptingUntil: 'Accepting until',
    posted: 'Posted',
    proofRequired: 'Proof required',
    arrangement: 'Arrangement',
  },
} as const

/**
 * The proof-upload dialog's sentences.
 *
 * Every requirement phrase goes through the SHARED `formatProofTypeList`, and
 * that is the whole point of this block: the helper's own doc says it exists
 * "so the server's rejection message and the app's checklist word the same
 * requirement identically — they read as one product voice, and neither can
 * drift into its own phrasing". The server refuses with
 * `This gig requires photo and video proof…`; mobile's `ProofRequirementsNote`
 * says `Required proof: photo and video` / `Still needed: …`. This dialog
 * hand-rolled a comma join instead and read `Still missing: photo, video.`,
 * so one worker could be told the same fact two ways in the same minute.
 * Mobile wins on copy (apps/web/CLAUDE.md), so these are mobile's words.
 */
export const PROOF_DIALOG_COPY = {
  required: (types: readonly ProofType[]) => `Required proof: ${formatProofTypeList(types)}.`,
  stillNeeded: (types: readonly ProofType[]) => ` Still needed: ${formatProofTypeList(types)}.`,
  allCovered: ' All required proof attached.',
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
  /** The retry has nothing to upload, so "Uploading…" would be a lie. */
  working: (reusing: boolean) => (reusing ? 'Submitting…' : 'Uploading…'),
} as const
