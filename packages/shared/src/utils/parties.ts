/**
 * Party-identity helpers shared by every dispute/escrow surface (admin
 * dossier, mediation-thread bubbles, mobile). The canonical structural
 * vocabulary is `creator | counterparty` — the SAME words the on-chain
 * `winner` enum and the resolve flow use — so one term threads end to end.
 * Human-facing labels are kind-aware and derived here, never hardcoded at
 * call sites.
 */
import type { EscrowKind } from '../types/escrow'
// Type-only, and deliberately so: `types/dossier` imports `PartyRole` from
// here, so a value import would close a runtime cycle. `import type` is erased.
import type { DossierParty } from '../types/dossier'
import type { ExchangePartyRef } from '../types/exchange'

/** Structural party identity; mirrors the escrow columns and winner enum. */
export type PartyRole = 'creator' | 'counterparty'

const PARTY_LABELS: Readonly<Record<EscrowKind, Record<PartyRole, string>>> = {
  // A gig poster funds the job; the counterparty does the work.
  gig: { creator: 'Poster', counterparty: 'Worker' },
  // An exchange maker posts the offer; the counterparty takes it.
  exchange: { creator: 'Maker', counterparty: 'Taker' },
}

/** Human label for a party, e.g. ('gig','counterparty') → 'Worker'. */
export function partyRoleLabel(kind: EscrowKind, role: PartyRole): string {
  return PARTY_LABELS[kind][role]
}

/**
 * Human label for a dispute outcome. `creator`/`counterparty` reuse the
 * party labels; `split` returns the shared even-split wording. Single source
 * for the resolution UI so option lists never hardcode outcome copy.
 */
export function winnerLabel(kind: EscrowKind, winner: PartyRole | 'split'): string {
  return winner === 'split' ? 'Split evenly' : partyRoleLabel(kind, winner)
}

/**
 * Semantic accent for a party. A TOKEN NAME, never a colour value — each
 * client keeps its own presentation, which is the half that legitimately
 * differs: web looks the token up in a Tailwind class table, while on mobile
 * it IS a `theme.colors` key (the bubble reads `.primary` off it) and also a
 * valid Avatar `tone` (the header chip passes it straight through).
 *
 * Shared because both clients had declared this identical map privately, each
 * under a docstring promising the context header and the thread "can never
 * drift into calling the poster one colour here and another there". That held
 * WITHIN a client and was exactly the drift it forbade one level up: nothing
 * stopped web tinting the poster with the accent while mobile tinted the taker
 * with it (#43).
 */
export type PartyAccent = 'accent' | 'brand'

const ROLE_ACCENTS: Readonly<Record<PartyRole, PartyAccent>> = {
  creator: 'accent',
  counterparty: 'brand',
}

/** Accent token for a party, e.g. 'counterparty' → 'brand'. */
export function partyAccent(role: PartyRole): PartyAccent {
  return ROLE_ACCENTS[role]
}

/**
 * The two nullable name columns joined, or `''` when there is no name.
 *
 * Returns the empty string ON PURPOSE rather than taking a fallback: what to
 * show for a nameless person is a per-surface decision, and the surfaces
 * genuinely disagree. Staff surfaces (admin, Slack, the bell feed) want the
 * shortened id, because a referenceable handle is the point — that is
 * `displayName` below. Consumer surfaces want a word, because a uuid prefix in
 * a chat list is noise to the person reading it. Both share THIS, which is the
 * part that was actually being duplicated.
 *
 * Whitespace-only is empty, which is the bug this exists to kill. Mobile had
 * inline copies of `[first, last].filter(Boolean).join(' ')` across its
 * person-rendering screens; `filter(Boolean)` KEEPS `'  '`, so the name
 * rendered as blank text and the `|| 'Anonymous'` after it never fired.
 *
 * Combine with `||`, never `??`: the no-name answer is `''`, which is falsy but
 * not nullish, so `?? 'Anonymous'` would reintroduce exactly that bug.
 */
export function formatFullName(first_name: string | null, last_name: string | null): string {
  return [first_name, last_name].filter((p) => p !== null && p.trim() !== '').join(' ').trim()
}

/**
 * Does this person have a usable name — BOTH parts, each non-blank once
 * trimmed? The single predicate behind "profile complete", app-wide.
 *
 * Deliberately NOT `formatFullName(...) !== ''`, which is the obvious-looking
 * reduction and is wrong: `formatFullName('John', '   ')` is `'John'`, so that
 * test calls a blank surname complete. The server's `requireProfileComplete`
 * demands both, so a client using the join would route someone to the home
 * screen and then have the API refuse their first gig with "Complete your
 * profile" — a loop with no visible cause. Completeness and display are
 * genuinely different questions; they only look alike in the both-blank case.
 *
 * `.trim()` is the whole point. Every site this replaced tested presence with
 * `x !== ''` or `Boolean(x)`, and `'  '` passes both — so a row holding two
 * spaces read as a named user to the routing check, to the create/accept guard
 * and to `profile_complete` on the wire, while every display surface fell back
 * to "Anonymous". Trimming on write is not enough on its own: rows written
 * before that landed, or by any client that skips it, still have to read false.
 */
export function hasCompleteName(first_name: string | null, last_name: string | null): boolean {
  return (first_name ?? '').trim() !== '' && (last_name ?? '').trim() !== ''
}

/**
 * "Wisdom A." — the name a STRANGER may see, before anyone has committed.
 *
 * An exchange offer pairs whoever posted it with the money they are moving and
 * a clock (#175). A full legal name beside that is a targeting list: P2P fraud
 * works by approaching the seller off-platform mid-window. The first name plus
 * one initial still reads as a person and still tells two sellers apart, which
 * is what a counterparty is actually deciding on; the rest waits for an
 * ACCEPTED intent, the same line `bank_accounts` already sits behind.
 *
 * Degrades rather than throws, because both columns are nullable:
 *   ('Wisdom', 'Abioye') -> 'Wisdom A.'    ('Wisdom', null)  -> 'Wisdom'
 *   (null, 'Abioye')     -> 'A.'           (null, null)      -> ''
 *
 * The initial is taken with `Array.from`, not `charAt(0)`: a name beginning
 * with an astral character (an emoji, or a script outside the BMP) would
 * otherwise be cut mid-surrogate and render as a replacement glyph.
 *
 * Whitespace-only counts as absent, matching `formatFullName` next door — the
 * bug that helper exists to kill is exactly the one this would reintroduce.
 */
export function abbreviatedName(first_name: string | null, last_name: string | null): string {
  const first = (first_name ?? '').trim()
  const last = (last_name ?? '').trim()
  const initial = last === '' ? '' : `${Array.from(last)[0]}.`
  return [first, initial].filter((part) => part !== '').join(' ')
}

/**
 * What to call an exchange party, from what the SERVER decided to send (#175).
 *
 * `full_name` is filled only for a settled party to that escrow and null for
 * everyone else, who gets the abbreviated `display_name`. The choice is already
 * made by then — this just reads it, in one place, so web and mobile cannot
 * come to different conclusions about the same payload.
 *
 * `||`, never `??`: a revealed party who never set a profile name has
 * `full_name: ''` (that is what `formatFullName` answers), and `??` would print
 * the empty string instead of falling through.
 *
 * Returns `''` when there is no name at all, like `formatFullName` — the word
 * to show instead is per-surface copy ("Trader" on the book, "Anonymous" on a
 * person card), which is why it is not decided here.
 */
export function exchangePartyName(
  party: Pick<ExchangePartyRef, 'full_name' | 'display_name'>,
): string {
  return party.full_name || party.display_name
}

/**
 * Best-effort display name from the two nullable name columns. Falls back
 * to the shortened id so a party with no profile name is still referenceable.
 *
 * The id fallback suits STAFF surfaces, where a referenceable handle is the
 * point; consumer surfaces generally want a word instead and should call
 * `formatFullName` — see its note. Generally, not always: mobile's
 * DisputeContextHeader calls this WITH the id on purpose, because a dispute
 * thread is shared with a mediator and "User 3f2a1b8c" is something a party can
 * quote to support. Pick per surface; do not read this as a layer rule.
 */
export function displayName(
  first_name: string | null,
  last_name: string | null,
  fallbackId?: string,
): string {
  const full = formatFullName(first_name, last_name)
  if (full !== '') return full
  if (fallbackId !== undefined && fallbackId !== '') return `User ${fallbackId.slice(0, 8)}`
  return 'Unknown'
}

// ---------- dispute-thread sender identity -----------------------------------

/**
 * Who a dispute message came from, from ONE viewer's seat. `unknown` is not a
 * failure mode — it is the honest answer when the caller has no party list yet
 * (a `?after=` tail poll before the full load, or the admin dossier still in
 * flight), and it is why this cannot silently fall through to `mediator`.
 */
export type DisputeSenderKind = 'me' | 'party' | 'mediator' | 'unknown'

export interface DisputeSender {
  kind: DisputeSenderKind
  /** Structural role when the sender is a known party; null otherwise. */
  role: PartyRole | null
  /** Bubble label: 'You' | '<Role> · <Name>' | 'Mediator' | 'Participant'. */
  label: string
}

const SELF_LABEL = 'You'
const MEDIATOR_LABEL = 'Mediator'
/** A sender we cannot place, because the party list has not arrived. */
const UNPLACED_LABEL = 'Participant'
const ROLE_NAME_SEPARATOR = ' · '

export interface DisputeSenderArgs {
  senderId: string
  /** The reader. Empty string (signed-out / not yet hydrated) matches nobody. */
  viewerId: string
  /** Drives Poster/Worker vs Maker/Taker. Null ⇒ label falls back to the name. */
  kind: EscrowKind | null
  /** The escrow's parties. Empty ⇒ nothing can be placed but the viewer. */
  parties: readonly DossierParty[]
}

/**
 * Resolve one dispute-thread message to a labelled sender.
 *
 * Deliberately knows NOTHING about who currently holds the claim. Membership
 * of `parties` is what makes someone a disputant, and only parties or a
 * claim-holding admin can post (see the thread POST guard), so "not a party"
 * IS "mediator" — for the admin who wrote it as well as for one who has since
 * handed the claim on. Keying off the current assignee instead produced three
 * distinct mislabellings: a mediator saw both disputants under the first
 * party's name, a party who held the claim was dressed up as the neutral
 * mediator, and a previous mediator's messages were attributed to the reader's
 * opponent.
 */
export function resolveDisputeSender(args: DisputeSenderArgs): DisputeSender {
  const { senderId, viewerId, kind, parties } = args
  const party = parties.find((p) => p.user_id === senderId) ?? null

  // Self first: the viewer's own bubble is identifiable even with no context.
  if (viewerId !== '' && senderId === viewerId) {
    return { kind: 'me', role: party?.role ?? null, label: SELF_LABEL }
  }
  if (party !== null) {
    const name = displayName(party.first_name, party.last_name, party.user_id)
    return {
      kind: 'party',
      role: party.role,
      label: kind === null ? name : `${partyRoleLabel(kind, party.role)}${ROLE_NAME_SEPARATOR}${name}`,
    }
  }
  // No party list ⇒ we genuinely cannot tell a mediator from a disputant.
  if (parties.length === 0) {
    return { kind: 'unknown', role: null, label: UNPLACED_LABEL }
  }
  return { kind: 'mediator', role: null, label: MEDIATOR_LABEL }
}

/** Which seat the READER occupies on a dispute thread. */
export type DisputeViewerSeat = 'party' | 'mediator' | 'unknown'

/**
 * Place the reader on a dispute thread, by the same membership rule
 * `resolveDisputeSender` places message authors with — so a screen's copy and
 * its bubbles can never disagree about who someone is.
 *
 * `unknown` matters: callers use this to decide whether to WITHHOLD something
 * (a composer, disputant-shaped copy), and guessing `mediator` with no party
 * list would silence an actual disputant. Fail open on `unknown`.
 */
export function disputeViewerSeat(
  parties: readonly DossierParty[],
  viewerId: string,
): DisputeViewerSeat {
  if (viewerId === '' || parties.length === 0) return 'unknown'
  return parties.some((p) => p.user_id === viewerId) ? 'party' : 'mediator'
}

/**
 * A person's reputation as a display string ('4.8'), or null when they have
 * none yet.
 *
 * `users.review_score` is `numeric(3,2)` and NULLABLE with no default: NULL is
 * "nobody has reviewed them", and a stored `0.00` is a real average that must
 * be shown, not hidden. Four surfaces had four rules for that distinction —
 * one dropped a genuine zero, one rendered the raw '4.80', one printed an em
 * dash — so the same person's standing read differently depending on which
 * screen you were looking at.
 *
 * One decimal because the underlying value is an average of a handful of
 * scores; the second decimal is noise the column happens to store.
 */
export function formatReviewScore(review_score: string | null | undefined): string | null {
  if (review_score === null || review_score === undefined) return null
  const score = Number.parseFloat(review_score)
  // Guards the empty string and any non-numeric text: unknown, not zero.
  if (!Number.isFinite(score)) return null
  return score.toFixed(1)
}
