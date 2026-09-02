/**
 * What every namespace's gas-seed audit needs, whatever chain it verifies.
 *
 * The script was Solana-only and its error text hardcoded `CHAIN_SOLANA_*`
 * (#53b item 3). Splitting the namespace-agnostic half out is what lets an EVM
 * arm exist beside the Solana one instead of being bolted into it — and keeps
 * each file inside the line budget.
 */

/** The prefix a CLAIMED-but-unfinished grant's tx_ref carries. */
export const PLACEHOLDER_PREFIX = 'pending:'

/** One grant row, as the audit reads it. */
export interface GrantRow {
  user_id: string
  chain_id: string
  amount_raw: string
  tx_ref: string
  /**
   * Which hot wallet PAID this grant, recorded per grant since #53c-1.
   *
   * The audit checks history against THIS rather than against whatever key is
   * configured now — before the column existed, rotating a seed key
   * retroactively flagged every grant the old wallet had paid as "funded by the
   * wrong wallet", an alarm that fires on a correct operation. Null for grants
   * written before the column, which fall back to the chain's current funder.
   */
  funder_address: string | null
  /** Which wallet was PAID. Null for pre-#53c-1 grants; the audit then skips the check. */
  wallet_address: string | null
  granted_at: Date
}

export interface CheckResult {
  user_id: string
  chain_id: string
  tx_ref: string
  ok: boolean
  detail: string
}

export function parseUserFilter(argv: readonly string[]): string | undefined {
  const i = argv.indexOf('--user')
  if (i === -1) return undefined
  const value = argv[i + 1]
  if (value === undefined || value.startsWith('--')) {
    throw new Error('--user requires a user id argument')
  }
  return value
}

/**
 * The one check every namespace shares: a grant still carrying the placeholder
 * never reached the chain at all, so there is nothing to look up.
 *
 * Returned as a RESULT rather than thrown: it is a real finding the operator
 * needs listed beside the others, not an error that stops the run.
 */
export function placeholderResult(grant: GrantRow): CheckResult | null {
  if (!grant.tx_ref.startsWith(PLACEHOLDER_PREFIX)) return null
  return {
    user_id: grant.user_id,
    chain_id: grant.chain_id,
    tx_ref: grant.tx_ref,
    ok: false,
    detail: 'placeholder tx_ref — slot claimed but transfer never finalized',
  }
}

/** The funder this grant should have been paid by: its own, else the chain's current one. */
export function expectedFunder(grant: GrantRow, chainFunder: string): string {
  return grant.funder_address ?? chainFunder
}
