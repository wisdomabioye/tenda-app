/**
 * Support-centre strings. Topic titles and blurbs are NOT here — those are
 * shared `SUPPORT_TOPICS`, the cross-client vocabulary; only the chrome around
 * them lives in this app.
 */
export const SUPPORT_COPY = {
  eyebrow: 'Support',
  indexHeading: 'Everything the escrow does, in plain words',
  indexIntro:
    'No account needed to read any of this. Each guide covers one part of the flow — what the money does, what you have to hand over, and what happens when something goes wrong.',
  navLabel: 'All guides',
  /** The aside's index entry — SUPPORT_TOPICS covers only the topics. */
  navIndex: 'Support home',
  /**
   * The comp's aside footnote. Named as a route rather than a vague gesture:
   * telling someone "contact support" without saying where is the kind of dead
   * end this page exists to prevent.
   */
  stuckNote: 'Still stuck? Signed-in users can open a support thread from Settings.',
  stuckLink: 'Go to Settings',
} as const
