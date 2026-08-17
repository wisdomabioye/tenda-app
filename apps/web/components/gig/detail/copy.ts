/**
 * Strings for the public gig detail (Tier 1 comp, lines 547-683). Product
 * facts come from `@tenda/shared`; only sentences live here.
 */
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
  postedByNote:
    'Full profiles, message threads and dispute history are visible to signed-in users.',
  noRating: 'No reviews yet',
  ratingCaption: 'out of 5',
  locked: 'Locked in escrow',
  lockedNote:
    'Chain-attested net. This is what reaches you on completion — the fee is already taken out.',
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
