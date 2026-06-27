/**
 * Semantic-parity check (pure, unit-testable). The ABI/IDL drift-guard secures
 * function/event SIGNATURES, but two protocol facts live outside them and are
 * hand-mirrored across the EVM contract, the Anchor program, and the shared TS
 * constants:
 *
 *   1. enum ORDER (Status / Kind / Winner) — the on-chain `uint8` wire value.
 *      A Solidity enum is rendered as bare `uint8` in the ABI, so reordering it
 *      is INVISIBLE to the artifact guard yet silently re-maps every decode.
 *   2. protocol LIMIT constants (fee bps, approval window, grace, completion
 *      duration) — enforced on-chain, mirrored by off-chain validation.
 *
 * This parses all three sources into one normalized spec and asserts they are
 * identical, so a change on any side fails CI/precommit.
 */

const TIME_UNITS = { seconds: 1, minutes: 60, hours: 3600, days: 86400, weeks: 604800 }

/**
 * Evaluate a duration/number expression to an integer, spanning the three
 * syntaxes in play: Solidity (`30 days`, `3_600`), Rust (`30 * 24 * 3_600`),
 * and TS (`30 * 24 * 60 * 60`). Product of whitespace/`*`-separated factors,
 * each a number or a Solidity time-unit keyword.
 */
export function evalSeconds(expr) {
  const tokens = String(expr).replace(/_/g, '').split(/[\s*]+/).filter(Boolean)
  if (tokens.length === 0) throw new Error(`evalSeconds: empty expression "${expr}"`)
  let product = 1
  for (const tok of tokens) {
    const val = tok in TIME_UNITS ? TIME_UNITS[tok] : Number(tok)
    if (!Number.isInteger(val)) throw new Error(`evalSeconds: cannot evaluate token "${tok}" in "${expr}"`)
    product *= val
  }
  return product
}

/** Variant names from an enum body, comment- and discriminant-stripped, lowercased. */
export function parseEnumVariants(body) {
  return body
    .split(',')
    .map((entry) => entry.replace(/\/\/[^\n]*/g, '').replace(/=\s*\d+/g, ''))
    .map((entry) => {
      const m = entry.match(/[A-Za-z_]\w*/)
      return m ? m[0].toLowerCase() : null
    })
    .filter((v) => v !== null)
}

function enumBody(src, name, kind) {
  // Solidity: `enum Status { ... }`; Rust: `pub enum EscrowStatus { ... }`
  const re = new RegExp(`enum\\s+${name}\\s*\\{([^}]*)\\}`)
  const m = src.match(re)
  if (m === null) throw new Error(`parity: ${kind} enum "${name}" not found`)
  return m[1]
}

/** `name -> rawExpr` for `const NAME = <expr>;` (Rust) or `constant NAME = <expr>;` (Solidity). */
function rawConstants(src) {
  const out = {}
  const re = /(?:const|constant)\s+(\w+)(?:\s*:\s*\w+)?\s*=\s*([^;]+);/g
  let m
  while ((m = re.exec(src)) !== null) out[m[1]] = m[2].trim()
  return out
}

function requireConst(consts, name, label) {
  if (!(name in consts)) throw new Error(`parity: constant "${name}" not found in ${label}`)
  return evalSeconds(consts[name])
}

/** Map an ordered variant list to a name->index code object. */
function codesByIndex(variants) {
  return Object.fromEntries(variants.map((v, i) => [v, i]))
}

/** @returns normalized EscrowSpec from the EVM Solidity source. */
export function parseSolidity(src) {
  const c = rawConstants(src)
  return {
    status: parseEnumVariants(enumBody(src, 'Status', 'solidity')),
    kind: { gig: requireConst(c, 'KIND_GIG', 'solidity'), exchange: requireConst(c, 'KIND_EXCHANGE', 'solidity') },
    winner: {
      creator: requireConst(c, 'WINNER_CREATOR', 'solidity'),
      counterparty: requireConst(c, 'WINNER_COUNTERPARTY', 'solidity'),
      split: requireConst(c, 'WINNER_SPLIT', 'solidity'),
    },
    limits: {
      maxPlatformFeeBps: requireConst(c, 'MAX_PLATFORM_FEE_BPS', 'solidity'),
      minApprovalWindowSeconds: requireConst(c, 'MIN_APPROVAL_WINDOW_SECONDS', 'solidity'),
      maxApprovalWindowSeconds: requireConst(c, 'MAX_APPROVAL_WINDOW_SECONDS', 'solidity'),
      maxGracePeriodSeconds: requireConst(c, 'MAX_GRACE_PERIOD_SECONDS', 'solidity'),
      minCompletionDurationSeconds: requireConst(c, 'MIN_COMPLETION_DURATION_SECONDS', 'solidity'),
      maxCompletionDurationSeconds: requireConst(c, 'MAX_COMPLETION_DURATION_SECONDS', 'solidity'),
    },
  }
}

/**
 * @param {string} escrowRs  contracts/solana/.../state/escrow.rs (enums)
 * @param {string} constantsRs  contracts/solana/.../constants.rs (limits)
 */
export function parseSolana(escrowRs, constantsRs) {
  const c = rawConstants(constantsRs)
  return {
    status: parseEnumVariants(enumBody(escrowRs, 'EscrowStatus', 'solana')),
    kind: codesByIndex(parseEnumVariants(enumBody(escrowRs, 'EscrowKind', 'solana'))),
    winner: codesByIndex(parseEnumVariants(enumBody(escrowRs, 'DisputeWinner', 'solana'))),
    limits: {
      maxPlatformFeeBps: requireConst(c, 'MAX_PLATFORM_FEE_BPS', 'solana'),
      minApprovalWindowSeconds: requireConst(c, 'MIN_APPROVAL_WINDOW_SECONDS', 'solana'),
      maxApprovalWindowSeconds: requireConst(c, 'MAX_APPROVAL_WINDOW_SECONDS', 'solana'),
      maxGracePeriodSeconds: requireConst(c, 'MAX_GRACE_PERIOD_SECONDS', 'solana'),
      minCompletionDurationSeconds: requireConst(c, 'MIN_COMPLETION_DURATION_SECONDS', 'solana'),
      maxCompletionDurationSeconds: requireConst(c, 'MAX_COMPLETION_DURATION_SECONDS', 'solana'),
    },
  }
}

function objectLiteral(src, name, label) {
  const m = src.match(new RegExp(`${name}\\s*=\\s*\\{([^}]*)\\}`))
  if (m === null) throw new Error(`parity: object "${name}" not found in ${label}`)
  const out = {}
  for (const pair of m[1].split(',')) {
    const km = pair.match(/(\w+)\s*:\s*([^,]+)/)
    if (km !== null) out[km[1]] = evalSeconds(km[2])
  }
  return out
}

function arrayLiteral(src, name, label) {
  const m = src.match(new RegExp(`${name}\\s*=\\s*\\[([^\\]]*)\\]`))
  if (m === null) throw new Error(`parity: array "${name}" not found in ${label}`)
  return [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1].toLowerCase())
}

/** @returns normalized EscrowSpec from packages/shared/src/constants/escrow.ts. */
export function parseSharedConstants(src) {
  return {
    status: arrayLiteral(src, 'ESCROW_STATUS_ORDER', 'shared'),
    kind: objectLiteral(src, 'ESCROW_KIND_CODE', 'shared'),
    winner: objectLiteral(src, 'DISPUTE_WINNER_CODE', 'shared'),
    limits: objectLiteral(src, 'ESCROW_LIMITS', 'shared'),
  }
}

/**
 * Assert every labelled spec is identical to the first. Throws with a precise
 * field path on the first divergence.
 *
 * @param {Array<{ label: string, spec: object }>} specs
 */
export function assertSpecsEqual(specs) {
  if (specs.length < 2) throw new Error('assertSpecsEqual: need at least two specs to compare')
  const [base, ...rest] = specs
  for (const { label, spec } of rest) {
    for (const field of ['status', 'kind', 'winner', 'limits']) {
      const a = JSON.stringify(base.spec[field])
      const b = JSON.stringify(spec[field])
      if (a !== b) {
        throw new Error(`parity mismatch in "${field}": ${base.label}=${a} ${label}=${b}`)
      }
    }
  }
  return base.spec
}
