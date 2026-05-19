/**
 * Server-issued single-use auth nonces. Replaces the ±5min timestamp window
 * in the wallet-auth flow. See stage-0 § Database `auth_nonces` table.
 *
 * Status: signatures-only scaffold. Implementation lands during Stage 0
 * work-pass with route + schema migration.
 *
 * Test coverage owed (testing-strategy.md § Stage 0):
 *   - issued nonces are 256 bits of entropy, base64url-encoded
 *   - issue() inserts row with expires_at = now() + 5min
 *   - consume() succeeds exactly once per nonce; second call throws AUTH_NONCE_REPLAY
 *   - consume() throws AUTH_NONCE_EXPIRED if expires_at < now()
 *   - consume() throws AUTH_NONCE_UNKNOWN if not in DB
 *   - concurrent consume() of the same nonce: exactly one wins (atomic UPDATE ... RETURNING)
 */

export interface IssuedNonce {
  /** base64url, 256 bits. */
  nonce: string
  /** Seconds until expiry; today: 300. */
  expires_in: number
  /**
   * ISO-8601 issued-at the client embeds in the auth-message template.
   * Server validates "issued_at within ±60s of receipt" at consume time;
   * not persisted to `auth_nonces` (the nonce uniqueness is enough — issued_at
   * is just a clock-skew guard against signed-message replay outside the window).
   */
  issued_at: string
}

export declare function issueNonce(): Promise<IssuedNonce>

export declare function consumeNonce(nonce: string): Promise<void>
