/**
 * §04 How escrow works — copy + structure lifted from
 * Tenda V2/landing/sections/04-how-escrow-works.html.
 *
 * One unified four-stage contract (not a Gig⇄Exchange toggle — the contract is
 * the same on both sides). Followed by a Fallback subsection that documents
 * the four exit routes + a code clause from the on-chain program.
 *
 * Aspirational facts that need verification before launch (audit firm + date,
 * full program id) are flagged via Placeholder issue ids.
 */

export type StageAccent = 'brand' | 'accent' | 'success' | 'content'

export interface EventRow {
  label: string
  value: string
  /** Visual hint: hash → mono small/dim, status → tone-tinted pill, amt → bold mono. */
  kind: 'plain' | 'status' | 'hash' | 'amt'
  /** Required when kind === 'status'. */
  statusTone?: 'locked' | 'in-progress' | 'released' | 'final'
}

export interface Stage {
  num: string
  accent: StageAccent
  tag: string
  name: string
  body: string
  event: { rows: readonly EventRow[] }
}

export const ESCROW_HEADER = {
  eyebrow: { num: '§ 04', label: 'How escrow works' },
  h2: {
    line1: 'Funds lock first.',
    dim: 'Proof releases them.',
    accent: 'Nothing in between.',
  },
  sub: 'Every gig and every trade follows the same four-stage on-chain contract. No platform-held balance. No "pending" you can\'t see. Every state change is a Solana transaction you can verify.',
  meta: [
    { k: 'Program', v: 'fromAppInfo:programIdShort' },
    { k: 'Chain',   v: 'fromAppInfo:network · ~400ms blocks' },
    { k: 'Audit',   v: 'Pre-mainnet · audit pending' },
  ],
} as const

export const STAGES: readonly Stage[] = [
  {
    num: '01',
    accent: 'brand',
    tag: 'Poster · Seller',
    name: 'Lock',
    body: "SOL leaves the poster's (or seller's) wallet and enters the on-chain escrow program. It is no longer in either party's control.",
    event: {
      rows: [
        { label: 'Event',  value: 'Locked',     kind: 'status', statusTone: 'locked' },
        { label: 'Amount', value: '0.50 SOL',   kind: 'amt' },
        { label: 'Tx',     value: '5Qf…aL2',    kind: 'hash' },
      ],
    },
  },
  {
    num: '02',
    accent: 'accent',
    tag: 'Worker · Buyer',
    name: 'Work',
    body: 'The worker (or buyer) accepts and delivers — package dropped, photo taken, fiat sent. Photo or video proof is uploaded.',
    event: {
      rows: [
        { label: 'Event', value: 'Proof submitted', kind: 'status', statusTone: 'in-progress' },
        { label: 'Proof', value: 'photo · 2 files', kind: 'plain' },
        { label: 'CID',   value: 'bafy…q9w',         kind: 'hash' },
      ],
    },
  },
  {
    num: '03',
    accent: 'success',
    tag: 'Poster · Seller',
    name: 'Approve',
    body: 'The poster (or seller) reviews proof and signs an approval. One tap. No back-office. No phone calls.',
    event: {
      rows: [
        { label: 'Event',  value: 'Approved',  kind: 'status', statusTone: 'released' },
        { label: 'Signer', value: '@yemi.sol', kind: 'plain' },
        { label: 'Tx',     value: '9Tk…rNx',   kind: 'hash' },
      ],
    },
  },
  {
    num: '04',
    accent: 'content',
    tag: 'Program · Atomic',
    name: 'Release',
    body: 'In the same block, the program splits the locked SOL — payout to the worker (or buyer), fee to Tenda. Settlement under 2 seconds.',
    event: {
      rows: [
        { label: 'Event',   value: 'Settled',         kind: 'status', statusTone: 'final' },
        { label: 'Payout',  value: '0.4875 SOL',      kind: 'amt' },
        { label: 'Fee',     value: '0.0125 SOL · 2.5%', kind: 'plain' },
      ],
    },
  },
] as const

export interface FallbackRoute {
  letter: 'A' | 'B' | 'C' | 'D'
  prefix: string
  body: string
  time: string
  /** Marks routes that aren't yet implemented in the on-chain program (tracked
   *  in open_issues.md). UI shows a "planned" pill and dims the row. */
  aspirational?: true
}

export const FALLBACK = {
  tag: 'Fallback · when things go wrong',
  h3: "If proof is missing or contested, escrow resolves — it doesn't disappear.",
  body: 'Funds are never stuck on Tenda. Every gig has a deterministic exit — initiated by a party, by a deadline, or by Tenda mediation. Whichever path triggers, both sides see the same on-chain receipt.',
  routes: [
    { letter: 'A', prefix: 'Cancel.',        body: 'Poster (or seller) cancels before a worker (or buyer) accepts → SOL returns to the locker.',        time: 'pre-accept' },
    { letter: 'B', prefix: 'Auto-approve.',  body: "If the poster (or seller) doesn't approve or dispute within the review window, SOL auto-releases to the worker (or buyer).",
      time: '48h', aspirational: true },
    { letter: 'C', prefix: 'Reclaim.',       body: 'Worker (or buyer) misses the proof-submission deadline → poster (or seller) can claim the refund.', time: 'post-deadline' },
    { letter: 'D', prefix: 'Dispute.',       body: 'Either side opens a dispute after proof is submitted → Tenda mediation reviews evidence and instructs the program to release or refund.', time: '≤ 24h' },
  ] satisfies readonly FallbackRoute[],
  clauseTitle: 'From the on-chain program',
  clauseFootnote: 'Simplified. Full enum lives in `tenda-escrow/state/escrow.rs`.',
} as const

/**
 * Snippet illustrating the on-chain `GigStatus` exit paths. Variant names
 * match the live program enum 1:1 — see
 * tenda-escrow/programs/tenda-escrow/src/state/escrow.rs.
 */
export const CLAUSE_LINES = [
  { kind: 'comment', text: '// every gig settles via one of these terminal states' },
  { kind: 'open',    text: 'match gig.status {' },
  { kind: 'arm',     name: 'Completed', value: 'split(payout, fee),       // approve_completion' },
  { kind: 'arm',     name: 'Cancelled', value: 'refund(poster),           // cancel_gig (pre-accept)' },
  { kind: 'arm',     name: 'Expired',   value: 'refund(poster),           // refund_expired' },
  { kind: 'arm',     name: 'Resolved',  value: 'arbitrate(winner),        // resolve_dispute' },
  { kind: 'close',   text: '}' },
] as const
