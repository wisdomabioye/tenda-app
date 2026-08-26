import type { FaqCategory } from '../types'

/**
 * Q.10–Q.12 — checked against the dispute instructions on both programs.
 *
 *   - `_disputable` accepts status Accepted OR Submitted, so a dispute does NOT
 *     require proof to exist first. The page used to say it did, which would
 *     strand exactly the person who needs to escalate early.
 *   - `DisputeWinner` is Creator | Counterparty | **Split** — three outcomes,
 *     not the binary "release or refund" this page described.
 *   - Raising a dispute posts a bond into the same vault as the principal
 *     (`_collectBond`), redistributed by the ruling. Previously unmentioned.
 *   - The escrowed asset is whatever the escrow holds — USDC for a gig. The old
 *     copy said the program "releases SOL to the worker", which is wrong on
 *     every chain and wrong for gigs on Solana too.
 */
export const DISPUTES_CATEGORY: FaqCategory = {
  num: '03',
  slug: 'disputes',
  title: 'Disputes',
  caption: '3 questions',
  questions: [
    {
      id: 'Q.10',
      question: 'What happens if the poster and worker disagree?',
      answer: (
        <>
          <p>
            Either side can open a dispute any time after the work is accepted — before or after
            proof is submitted, so you&apos;re not stuck waiting to escalate something that has
            already gone wrong. The escrow stays locked while a Tenda mediator reviews the
            evidence: proof submissions, message history, and each party&apos;s track record.
          </p>
          <p>
            There are <strong>three</strong> possible rulings, not two: pay the worker, refund
            the poster, or split the escrow between them — because plenty of real disagreements
            are partly right on both sides. Whichever it is, the mediator&apos;s decision
            triggers an on-chain instruction that moves the actual money. There&apos;s no
            off-platform settlement and no email thread that bypasses the contract.
          </p>
          <p>
            Opening a dispute requires posting a <strong>bond</strong>, held in the same escrow
            vault as the funds and redistributed by the ruling. It exists to make frivolous
            escalation cost something; raise a dispute in good faith and it comes back to you.
          </p>
        </>
      ),
    },
    {
      id: 'Q.11',
      question: 'How long does a dispute take to resolve?',
      answer: (
        <p>
          Most reviews land within a working day. We&apos;re deliberately not publishing a
          guaranteed turnaround yet — queue depth depends on volume, and a number we can&apos;t
          hold to is worth less than an honest range. The escrow stays safely locked the entire
          time; nobody can move the funds while a dispute is open.
        </p>
      ),
    },
    {
      id: 'Q.12',
      question: 'Can I appeal a dispute decision?',
      answer: (
        <p>
          Once the mediator&apos;s instruction settles on-chain, the outcome is final. If you
          believe the ruling was wrong, ping support — we&apos;ll review the case file. We
          can&apos;t reverse an on-chain settlement, but feedback shapes how future similar
          disputes are reviewed.
        </p>
      ),
    },
  ],
}
