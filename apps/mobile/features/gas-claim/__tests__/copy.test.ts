/**
 * What the gas-claim surfaces SAY (#53c-2).
 *
 * Copy gets its own suite because the distinctions here are behavioural, not
 * cosmetic: a user mid-claim who is told they already have gas goes looking for
 * money that has not arrived, and one whose grant is claimed must never be
 * offered it again. Those are the two sentences worth a test.
 */
import {
  GAS_CLAIM_REASON_COPY,
  GAS_CLAIM_STATE_COPY,
  GAS_CLAIM_UNAVAILABLE_FALLBACK,
  gasClaimMessage,
} from '../copy'
import type { GasSeedState, GasSeedUnavailableReason } from '@tenda/shared'

describe('gasClaimMessage', () => {
  it('offers the grant when it is actually available', () => {
    expect(gasClaimMessage('unclaimed', null, true)).toBe(GAS_CLAIM_STATE_COPY.unclaimed)
  })

  it('says a claim is ON ITS WAY, never that it is already claimed', () => {
    // The double-tap sentence. `in_progress` covers the queued transfer and the
    // one that landed but could not be stamped; in both the user has nothing in
    // hand yet, so "already claimed" would send them hunting for it.
    const message = gasClaimMessage('in_progress', 'already_granted', false)
    expect(message).toBe(GAS_CLAIM_STATE_COPY.in_progress)
    expect(message.toLowerCase()).not.toContain('already')
    expect(message.toLowerCase()).not.toContain('claimed')
  })

  it('a claimed grant reads as claimed, not as a refusal', () => {
    // `already_granted` is the server's REASON here, and rendering it would say
    // something operational instead of the one fact that matters.
    expect(gasClaimMessage('claimed', 'already_granted', false)).toBe(GAS_CLAIM_STATE_COPY.claimed)
  })

  it('an existing grant outranks every reason text', () => {
    // Whatever else is true of the chain, a user with a grant needs to hear
    // about their grant.
    for (const reason of ['claims_disabled', 'funder_empty', 'no_wallet'] as const) {
      expect(gasClaimMessage('in_progress', reason, false)).toBe(GAS_CLAIM_STATE_COPY.in_progress)
    }
  })

  it('each refusal a user can act on has its own sentence', () => {
    expect(gasClaimMessage('unclaimed', 'phone_required', false)).toBe(
      GAS_CLAIM_REASON_COPY.phone_required,
    )
    expect(gasClaimMessage('unclaimed', 'no_wallet', false)).toBe(GAS_CLAIM_REASON_COPY.no_wallet)
  })

  it('an unknown reason degrades to "not right now" instead of crashing', () => {
    // The map is Partial on purpose: a reason added server-side must not be
    // able to blank the card or throw before someone writes it a sentence.
    const unwritten = 'some_future_reason' as GasSeedUnavailableReason
    expect(gasClaimMessage('unclaimed', unwritten, false)).toBe(GAS_CLAIM_UNAVAILABLE_FALLBACK)
    expect(gasClaimMessage('unclaimed', null, false)).toBe(GAS_CLAIM_UNAVAILABLE_FALLBACK)
  })

  it('every state has copy, so no state can render empty', () => {
    const states: GasSeedState[] = ['unclaimed', 'in_progress', 'claimed']
    for (const state of states) {
      expect(GAS_CLAIM_STATE_COPY[state].length).toBeGreaterThan(0)
    }
  })

  it('mobile_only has NO entry — this app always stamps its sessions', () => {
    // If it ever appeared here it would mean the app was telling its own user
    // to go and use the app. Web owns that sentence.
    expect(GAS_CLAIM_REASON_COPY.mobile_only).toBeUndefined()
  })
})
