/**
 * Which CTA the gig detail offers, decided purely.
 *
 * This is where the mode-blindness bug lived: the bar offered "Accept Gig" on
 * an approval-mode gig and the transaction reverted on-chain, costing the
 * worker gas to discover. So the negatives here carry the weight — every case
 * asserts what is NOT offered as much as what is.
 */
import { approvalBranch, lifecycleBranch } from '../branches'
import {
  CREATOR_ID,
  STRANGER_ID,
  WORKER_ID,
  application,
  assignedApprovalGig,
  gigDetail,
  userRef,
} from '../../__fixtures__/gig-detail'
import type { ApplicationStatus, GigDetail } from '@tenda/shared'

const NOW = new Date()

function viewerWith(status: ApplicationStatus) {
  return { application: application({ status }), open_application_count: null }
}

function approvalGig(overrides: Partial<GigDetail> = {}): GigDetail {
  return gigDetail({ requires_approval: true, ...overrides })
}

// ── the bug this split exists to prevent ────────────────────────────────────

describe('mode awareness', () => {
  it('never offers Accept on an approval-mode gig', () => {
    expect(lifecycleBranch(approvalGig(), STRANGER_ID, NOW)).not.toBe('accept')
    // The same gig in instant mode does offer it, so the mode is what decided.
    expect(lifecycleBranch(gigDetail(), STRANGER_ID, NOW)).toBe('accept')
  })

  it('offers Accept on a direct invite only to the invited worker', () => {
    const invited = gigDetail({ assigned_counterparty_id: WORKER_ID })
    expect(lifecycleBranch(invited, WORKER_ID, NOW)).toBe('accept')
    expect(lifecycleBranch(invited, STRANGER_ID, NOW)).not.toBe('accept')
  })

  it('has no approval branch at all on an instant-mode gig', () => {
    expect(approvalBranch(gigDetail(), STRANGER_ID, NOW)).toBeNull()
  })
})

// ── the poster ──────────────────────────────────────────────────────────────

describe('poster branches', () => {
  it('sends the poster to the applicant list while the gig is open', () => {
    expect(approvalBranch(approvalGig(), CREATOR_ID, NOW)).toBe('assign')
  })

  it('drops the assign branch past accept_deadline, falling back to Claim Refund', () => {
    const expired = approvalGig({
      accept_deadline: new Date(NOW.getTime() - 1000).toISOString(),
    })
    expect(approvalBranch(expired, CREATOR_ID, NOW)).toBeNull()
    expect(lifecycleBranch(expired, CREATOR_ID, NOW)).toBe('refundExpired')
  })

  it('offers Release assignment inside the unassign window', () => {
    const gig = assignedApprovalGig({ assignedSecondsAgo: 60, unassignWindowSeconds: 3600 })
    expect(approvalBranch(gig, CREATOR_ID, NOW)).toBe('unassign')
  })

  it('withdraws the release once the window closes, leaving the ordinary Dispute', () => {
    const gig = assignedApprovalGig({ assignedSecondsAgo: 3601, unassignWindowSeconds: 3600 })
    expect(approvalBranch(gig, CREATOR_ID, NOW)).toBeNull()
    expect(lifecycleBranch(gig, CREATOR_ID, NOW)).toBe('disputeOnly')
  })

  it('never offers unassign on an instant-mode gig — that worker signed', () => {
    const gig = assignedApprovalGig({}, { requires_approval: false })
    expect(approvalBranch(gig, CREATOR_ID, NOW)).toBeNull()
  })
})

// ── the worker ──────────────────────────────────────────────────────────────

describe('worker branches', () => {
  it('offers Apply to a stranger who has never applied', () => {
    expect(approvalBranch(approvalGig(), STRANGER_ID, NOW)).toBe('apply')
  })

  it('offers Withdraw once their application is live, not Apply again', () => {
    const gig = approvalGig({ viewer: viewerWith('open') })
    expect(approvalBranch(gig, STRANGER_ID, NOW)).toBe('withdraw')
  })

  it('re-offers Apply after they withdrew or it expired', () => {
    expect(approvalBranch(approvalGig({ viewer: viewerWith('withdrawn') }), STRANGER_ID, NOW)).toBe('apply')
    expect(approvalBranch(approvalGig({ viewer: viewerWith('expired') }), STRANGER_ID, NOW)).toBe('apply')
  })

  it('tells a passed applicant plainly instead of showing nothing', () => {
    const gig = approvalGig({ status: 'accepted', viewer: viewerWith('passed') })
    expect(approvalBranch(gig, STRANGER_ID, NOW)).toBe('lost')
  })

  it("never offers Apply on someone's own gig", () => {
    expect(approvalBranch(approvalGig(), CREATOR_ID, NOW)).toBe('assign')
    expect(approvalBranch(approvalGig({ status: 'accepted' }), CREATOR_ID, NOW)).toBeNull()
  })
})

// ── the assigned worker ─────────────────────────────────────────────────────

describe('assigned worker', () => {
  it("offers the free off-chain 'not available'", () => {
    const gig = assignedApprovalGig()
    expect(approvalBranch(gig, WORKER_ID, NOW)).toBe('release')
  })

  it('does not re-offer it once stamped, and hands back Submit Proof', () => {
    const gig = assignedApprovalGig({}, {
      assignment_released_at: new Date(NOW.getTime() - 1000).toISOString(),
    })
    expect(approvalBranch(gig, WORKER_ID, NOW)).toBeNull()
    expect(lifecycleBranch(gig, WORKER_ID, NOW)).toBe('submit')
  })

  /**
   * The winner's application is `assigned`, and an earlier draft of the
   * fallback branch caught it — showing "You got this gig" to someone halfway
   * through delivering it, in place of Add More Proof.
   */
  it('gives the WINNER the lifecycle buttons, not an application status line', () => {
    const gig = assignedApprovalGig({}, {
      status: 'submitted',
      viewer: viewerWith('assigned'),
      counterparty: userRef(WORKER_ID),
    })
    expect(approvalBranch(gig, WORKER_ID, NOW)).toBeNull()
    expect(lifecycleBranch(gig, WORKER_ID, NOW)).toBe('addProof')
  })
})

// ── the lifecycle branches are unchanged by the split ───────────────────────

describe('lifecycle regressions', () => {
  it('still routes drafts, submit, approve, review and disputed', () => {
    expect(lifecycleBranch(gigDetail({ status: 'draft' }), CREATOR_ID, NOW)).toBe('draft')
    expect(
      lifecycleBranch(
        gigDetail({ status: 'accepted', counterparty: userRef(WORKER_ID) }),
        WORKER_ID,
        NOW,
      ),
    ).toBe('submit')
    expect(
      lifecycleBranch(
        gigDetail({ status: 'submitted', counterparty: userRef(WORKER_ID) }),
        CREATOR_ID,
        NOW,
      ),
    ).toBe('approve')
    expect(
      lifecycleBranch(
        gigDetail({ status: 'completed', counterparty: userRef(WORKER_ID) }),
        CREATOR_ID,
        NOW,
      ),
    ).toBe('review')
    expect(
      lifecycleBranch(
        gigDetail({ status: 'disputed', counterparty: userRef(WORKER_ID) }),
        CREATOR_ID,
        NOW,
      ),
    ).toBe('disputedNotice')
  })

  it('offers Claim Payment once the approval window has passed', () => {
    const gig = gigDetail({
      status: 'submitted',
      counterparty: userRef(WORKER_ID),
      approval_deadline: new Date(NOW.getTime() - 1000).toISOString(),
    })
    expect(lifecycleBranch(gig, WORKER_ID, NOW)).toBe('claimAndProof')
  })

  it('shows nothing to a stranger on a finished gig', () => {
    const gig = gigDetail({ status: 'completed', counterparty: userRef(WORKER_ID) })
    expect(lifecycleBranch(gig, STRANGER_ID, NOW)).toBeNull()
    expect(approvalBranch(gig, STRANGER_ID, NOW)).toBeNull()
  })
})
