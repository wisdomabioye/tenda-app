/**
 * What the dossier says about an escrow beside its money.
 *
 * The rule under test is the same one every surface in this app keeps: a fact
 * with nothing behind it is OMITTED, never printed as a label with an em dash.
 * A blank beside "Deliver by" reads as a date the poster failed to set, when
 * the truth is that this gig has no completion deadline yet.
 */
import { describe, expect, it } from 'vitest'
import { PROOF_TYPE_LABEL, type GigDetail } from '@tenda/shared'
import { dossierFactsFor, dossierProofsFor } from '@/components/gig/my-gigs/dossier-facts'
import { deliveryGig } from '@/e2e/fixtures/gigs'

const detail = (over: Partial<GigDetail> = {}): GigDetail =>
  ({
    ...deliveryGig,
    counterparty: null,
    proofs: null,
    is_assigned: false,
    is_seeker: false,
    ...over,
  }) as GigDetail

const labels = (gig: GigDetail) => dossierFactsFor(gig).map((fact) => fact.label)

describe('dossierFactsFor', () => {
  it('always names the chain — the money is on one, and which one matters', () => {
    expect(labels(detail({ accept_deadline: null, completion_deadline: null, approval_deadline: null }))).toEqual(['Chain'])
  })

  it('adds each deadline the escrow actually has', () => {
    expect(
      labels(
        detail({
          accept_deadline: '2026-08-20T10:00:00.000Z',
          completion_deadline: '2026-08-22T10:00:00.000Z',
          approval_deadline: '2026-08-25T10:00:00.000Z',
        }),
      ),
    ).toEqual(['Chain', 'Accept by', 'Deliver by', 'Auto-releases'])
  })

  it('omits a deadline that is not set rather than printing an empty one', () => {
    const facts = labels(
      detail({
        accept_deadline: '2026-08-20T10:00:00.000Z',
        completion_deadline: null,
        approval_deadline: null,
      }),
    )
    expect(facts).toEqual(['Chain', 'Accept by'])
    expect(facts).not.toContain('Deliver by')
  })
})

describe('dossierProofsFor', () => {
  it('answers null when the server withheld the party half', () => {
    // An outsider gets no proofs at all — not an empty list, which would read
    // as "they submitted nothing".
    expect(dossierProofsFor(null)).toBeNull()
    expect(dossierProofsFor(undefined)).toBeNull()
  })

  it('labels each proof with the SHARED vocabulary', () => {
    expect(
      dossierProofsFor([
        { id: 'p1', type: 'image', uploaded_at: '2026-08-16T10:00:00.000Z' },
      ]),
    ).toEqual([{ id: 'p1', label: PROOF_TYPE_LABEL.image, uploadedAt: '2026-08-16T10:00:00.000Z' }])
  })

  it('takes the stamp in EITHER form the type and the wire disagree about', () => {
    // `EscrowProof` is the Drizzle row, so TypeScript says `uploaded_at` is a
    // Date; JSON has already made it a string by the time a browser sees it.
    // Handling only one of them silently drops every stamp.
    const asDate = dossierProofsFor([
      { id: 'p1', type: 'document', uploaded_at: new Date('2026-08-16T10:00:00.000Z') },
    ])
    expect(asDate?.[0].uploadedAt).toBe('2026-08-16T10:00:00.000Z')

    const missing = dossierProofsFor([{ id: 'p2', type: 'document', uploaded_at: null }])
    expect(missing?.[0].uploadedAt).toBeNull()
  })
})
