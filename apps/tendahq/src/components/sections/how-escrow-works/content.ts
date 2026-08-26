/**
 * §04 How escrow works.
 *
 * One unified four-stage contract (not a Gig⇄Exchange toggle — the contract is
 * the same on both sides). Followed by a Fallback subsection documenting every
 * exit route the programs actually implement.
 *
 * EVERY claim here is checked against the contracts, not against intent:
 *   - Gigs are USDC-only. `assertGigAsset` permits exactly one asset per chain
 *     for gigs and the manifest marks USDC as that asset on all of them; the
 *     other tokens carry the `exchange` role only.
 *   - The platform fee comes OUT of the counterparty's payout — the contract
 *     pays `amount − fee` (`_settleToCounterparty`). Stage 04's numbers say so.
 *   - There are FIVE exits, not four: cancel, expire, claim-unpaid, reclaim and
 *     dispute. Route C is a worker PULL (`claimStalledPayment`), never an
 *     automatic release — nothing sweeps the chain on the worker's behalf.
 *   - Disputes open from Accepted OR Submitted (`_disputable`), so a worker
 *     does not have to submit proof first to escalate.
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
  sub: 'Every gig and every trade follows the same four-stage on-chain contract — on whichever chain you choose. No platform-held balance. No "pending" you can\'t see. Every state change is a transaction you can verify in a block explorer.',
  meta: [
    { k: 'Chains',    v: 'fromAppInfo:networksLine' },
    { k: 'Release',   v: 'fromAppInfo:stage' },
    { k: 'Contracts', v: 'Open source · Apache-2.0' },
  ],
} as const

export const STAGES: readonly Stage[] = [
  {
    num: '01',
    accent: 'brand',
    tag: 'Poster · Seller',
    name: 'Lock',
    body: "The money leaves the poster's (or seller's) wallet and enters the on-chain escrow contract. Gigs are always escrowed in USDC; a trade can lock USDC or the chain's own token. Either way it is no longer in either party's control.",
    event: {
      rows: [
        { label: 'Event',  value: 'Locked',     kind: 'status', statusTone: 'locked' },
        { label: 'Amount', value: '12 USDC',    kind: 'amt' },
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
    accent: 'brand',
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
    body: 'In the same transaction, the contract splits the locked funds — the payout to the worker (or buyer), the platform fee to Tenda. The fee comes out of that payout, so what the poster locks is exactly what the poster spends.',
    event: {
      rows: [
        { label: 'Locked',  value: '12 USDC',         kind: 'amt' },
        { label: 'Fee',     value: '0.30 USDC · 2.5%', kind: 'plain' },
        { label: 'Payout',  value: '11.70 USDC',      kind: 'amt' },
      ],
    },
  },
] as const

export interface FallbackRoute {
  letter: 'A' | 'B' | 'C' | 'D' | 'E'
  prefix: string
  body: string
  time: string
}

export const FALLBACK = {
  tag: 'Fallback · when things go wrong',
  h3: "If proof is missing or contested, escrow resolves — it doesn't disappear.",
  body: 'Funds are never stuck on Tenda. Every escrow has a deterministic exit — taken by a party, opened by a deadline, or settled by Tenda mediation. Whichever path triggers, both sides see the same on-chain receipt.',
  routes: [
    {
      letter: 'A',
      prefix: 'Cancel.',
      body: 'Poster (or seller) cancels while the escrow is still open and nobody has accepted → the funds return to whoever locked them.',
      time: 'pre-accept',
    },
    {
      letter: 'B',
      prefix: 'Expire.',
      body: 'Nobody accepts before the accept deadline → the locker refunds themselves on-chain. Nothing is left parked in a job no one wanted.',
      time: 'accept deadline',
    },
    {
      letter: 'C',
      prefix: 'Claim unpaid.',
      body: "Proof is in and the poster neither approves nor disputes within the review window → the worker claims the payment themselves, split exactly as an approval would have been. It is a claim you make, not a release that happens to you.",
      time: '48h',
    },
    {
      letter: 'D',
      prefix: 'Reclaim.',
      body: 'The worker accepted and never submitted proof → once the completion deadline plus a short grace period passes, the poster claims the refund.',
      time: 'deadline + grace',
    },
    {
      letter: 'E',
      prefix: 'Dispute.',
      body: 'Either side escalates once work is accepted — before or after proof. The party raising it posts a bond. Mediation reviews the evidence and instructs the program to pay the worker, refund the poster, or split between them.',
      time: 'mediated',
    },
  ] satisfies readonly FallbackRoute[],
} as const
