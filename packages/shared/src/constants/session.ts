/**
 * Which client minted a session.
 *
 * A GENERIC session fact, not a feature flag. It records how a token came into
 * existence — the app, or the browser — which is useful for audit, for support
 * ("they were on web"), and for any surface that is legitimately app-only. The
 * first such surface is the gas-seed claim (#53c-1), but nothing here mentions
 * it and nothing here should: the moment this becomes "the gas-seed field", it
 * stops being safe to read anywhere else and starts being one more thing to
 * unpick when that feature is removed.
 *
 * The stamp is a CLAIM BY THE CLIENT, not a proof. A determined caller can send
 * whatever header they like, which is exactly why it is never the only gate on
 * anything that matters — the claim surface pairs it with a registered device
 * and a verified phone. It raises the cost of a scripted signup; it does not
 * pretend to be attestation.
 */

/** The header a client sends at sign-in to stamp its session. Lower-case: Node normalises. */
export const SESSION_CLIENT_HEADER = 'x-tenda-client'

/**
 * The clients that may stamp a session. An allowlist rather than a free string,
 * so nothing a caller invents is copied verbatim into a signed token.
 */
export const SESSION_CLIENTS = ['mobile', 'web'] as const

export type SessionClient = (typeof SESSION_CLIENTS)[number]

/**
 * Read a client stamp from a header value, or null if it is absent or unknown.
 *
 * Unknown reads as ABSENT rather than throwing: a stamp is optional, an older
 * app build sends none, and refusing a sign-in over a header nobody depends on
 * would turn a cosmetic mismatch into an outage.
 */
export function parseSessionClient(value: string | undefined): SessionClient | null {
  if (value === undefined) return null
  const found = SESSION_CLIENTS.find((client) => client === value)
  return found ?? null
}
