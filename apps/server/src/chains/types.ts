/**
 * Cross-chain adapter contract.
 *
 * Every chain (Solana, BASE, CELO, ...) implements ChainAdapter so the rest
 * of the server can route by `chain_id` without knowing which protocol
 * sits underneath. See `multichain-migration-stages/stage-0-foundation.md`
 * § Server for context.
 *
 * Status: types-only scaffolding. Implementations land per stage:
 *   - Solana adapter:  Stage 0
 *   - EVM adapter:     Stage 3 (BASE) — same impl reused for Stage 4 (CELO)
 *   - Listeners:       Stage 2 onward
 *
 * No `any` / `unknown` casts allowed (project rule). Payloads are discriminated
 * unions per `action`; UserOperation is fully typed; event-payload fields are
 * stringified for u64/u256 precision safety.
 */

import type { ChainNamespace } from '@tenda/shared/db/schema/chains'

// ---------- shared value types --------------------------------------------

/** CAIP-2 chain id, e.g. `'solana:mainnet'`, `'eip155:8453'`. */
export type ChainId = string

/** CAIP-10 account id, e.g. `'eip155:8453:0xabc...'`. */
export type CaipAccountId = string

/** Asset registry id (matches `assets.id`), e.g. `'USDC_BASE'`. */
export type AssetId = string

/** Stage 0 amount convention: numeric(78,0) as string in JS. */
export type AmountRaw = string

/**
 * Type guard for `AmountRaw`. The string must be a non-empty decimal integer
 * (no sign, no decimal point, no whitespace, no leading zeros except `'0'`
 * itself). Postgres `numeric(78,0)` accepts wider input than this, but every
 * Stage-0 producer (fee math, dispute bond, on-chain payloads) wants the
 * canonical form to avoid `BigInt('  42 ')` and other parser surprises. See
 * open_issues.md S0-6.
 */
const AMOUNT_RAW_RE = /^(0|[1-9][0-9]*)$/

export function isAmountRaw(value: unknown): value is AmountRaw {
  return typeof value === 'string' && AMOUNT_RAW_RE.test(value)
}

/**
 * Discriminated escrow action. The wire-name (`'createEscrow'`) maps to the
 * Solana instruction / Solidity function 1:1 — adapters do not rename.
 */
export type EscrowAction =
  | 'createEscrow'
  | 'acceptEscrow'
  | 'declineAssignedEscrow'
  | 'submitProof'
  | 'approveCompletion'
  | 'claimStalledPayment'
  | 'cancelEscrow'
  | 'refundExpired'
  | 'reclaimAbandoned'
  | 'disputeEscrow'
  | 'resolveDispute'

/**
 * On-chain event names (PascalCase). Republished onto the internal queue
 * in snake_case by `chains/<ns>/verify.ts` per stage-2 convention.
 *
 * The runtime array and the type union are derived from the same const, so
 * `idempotency.ts` / `verify.ts` can iterate and validate without drift.
 */
export const ESCROW_EVENTS = [
  'EscrowCreated',
  'EscrowAccepted',
  'EscrowDeclined',
  'ProofSubmitted',
  'EscrowApproved',
  'PaymentClaimed',
  'EscrowCancelled',
  'EscrowExpired',
  'EscrowAbandoned',
  'DisputeRaised',
  'DisputeResolved',
] as const

export type EscrowEvent = (typeof ESCROW_EVENTS)[number]

/**
 * DB-vocabulary transaction types (`escrow_transactions.type` /
 * `tx_attempts.action` — snake_case). Single source lives in @tenda/shared
 * (mobile builds client-ping bodies from the same const — resolves
 * open_issues §10.9 for the tx-type axis); re-exported here so chain code
 * keeps one import surface.
 */
import type { EscrowTxType } from '@tenda/shared'
export { ESCROW_TX_TYPES, isEscrowTxType } from '@tenda/shared'
export type { EscrowTxType } from '@tenda/shared'

/**
 * Which on-chain event confirms each client-submitted action. The client
 * ping (`POST /v1/blockchain/transaction`) uses this to tell verify-tx what
 * to expect; the decoded event is the source of truth, never the hint.
 */
export const EVENT_BY_TX_TYPE: Record<EscrowTxType, EscrowEvent> = {
  create: 'EscrowCreated',
  accept: 'EscrowAccepted',
  decline: 'EscrowDeclined',
  submit: 'ProofSubmitted',
  approve: 'EscrowApproved',
  claim_stalled: 'PaymentClaimed',
  cancel: 'EscrowCancelled',
  refund_expired: 'EscrowExpired',
  reclaim_abandoned: 'EscrowAbandoned',
  dispute: 'DisputeRaised',
  resolve: 'DisputeResolved',
}

// ---------- buildTx -------------------------------------------------------

// Action-specific payloads. Discriminated by `action` so adapter `buildTx`
// branches narrow the payload statically.

export interface CreateEscrowPayload {
  /**
   * Server-generated DB row id (`escrows.id`, UUID), populated by the route
   * handler from the `INSERT ... RETURNING id` of the draft escrow row.
   * NOT the on-chain `escrow_ref` — that's emitted by the contract.
   */
  escrow_id: string
  kind: 'gig' | 'exchange'
  asset: AssetId
  amount_raw: AmountRaw
  /**
   * User id of the direct-assigned counterparty, if any. The adapter
   * resolves the wallet through its injected resolver (same pattern as
   * `raiser_user_id`) so routes never touch wallet columns.
   */
  assigned_counterparty_user_id?: string
  accept_deadline_unix: number
  completion_duration_seconds: number
  dispute_bond_raw: AmountRaw
  is_seeker: boolean
}

export interface EscrowIdPayload {
  escrow_id: string
}

export interface SubmitProofPayload {
  escrow_id: string
  /** 32-byte hex (EVM) or base58 (Solana) hash of the proof bundle. */
  proof_hash: string
}

export interface DisputeEscrowPayload {
  escrow_id: string
  /** Bond `msg.value` for EVM; lamport transfer for Solana. */
  bond_raw: AmountRaw
}

export interface ResolveDisputePayload {
  escrow_id: string
  winner: 'creator' | 'counterparty' | 'split'
  /**
   * User id of the party that raised the dispute (`disputes.raised_by`).
   * Solana's `resolve_dispute_*` takes the raiser's wallet as an instruction
   * argument (bond routing) — the adapter resolves the wallet through its
   * injected resolver. The EVM contract records the raiser on-chain at
   * `disputeEscrow` and ignores this field.
   */
  raiser_user_id: string
}

export type BuildTxArgs =
  | { action: 'createEscrow'; user_id: string; payload: CreateEscrowPayload }
  | { action: 'acceptEscrow'; user_id: string; payload: EscrowIdPayload }
  | { action: 'declineAssignedEscrow'; user_id: string; payload: EscrowIdPayload }
  | { action: 'submitProof'; user_id: string; payload: SubmitProofPayload }
  | { action: 'approveCompletion'; user_id: string; payload: EscrowIdPayload }
  | { action: 'claimStalledPayment'; user_id: string; payload: EscrowIdPayload }
  | { action: 'cancelEscrow'; user_id: string; payload: EscrowIdPayload }
  | { action: 'refundExpired'; user_id: string; payload: EscrowIdPayload }
  | { action: 'reclaimAbandoned'; user_id: string; payload: EscrowIdPayload }
  | { action: 'disputeEscrow'; user_id: string; payload: DisputeEscrowPayload }
  | { action: 'resolveDispute'; user_id: string; payload: ResolveDisputePayload }

/**
 * ERC-4337 UserOperation shape. Per the spec; bundlers expect every field
 * present (some can be `'0x'` for empty). Each value is hex-string so we
 * don't lose u256 precision through JS `number`.
 */
export interface UserOperation {
  sender: `0x${string}`
  nonce: `0x${string}`
  init_code: `0x${string}`
  call_data: `0x${string}`
  call_gas_limit: `0x${string}`
  verification_gas_limit: `0x${string}`
  pre_verification_gas: `0x${string}`
  max_fee_per_gas: `0x${string}`
  max_priority_fee_per_gas: `0x${string}`
  paymaster_and_data: `0x${string}`
  signature: `0x${string}`
}

export type UnsignedTx =
  | {
      kind: 'solana-tx'
      /** base64-serialized unsigned versioned transaction. */
      tx_base64: string
      recent_blockhash: string
      last_valid_block_height: number
    }
  | {
      kind: 'evm-tx'
      to: `0x${string}`
      data: `0x${string}`
      value: AmountRaw
      gas_limit?: AmountRaw
      /**
       * CELO gas abstraction (stage-4): pay gas in this whitelisted ERC-20
       * (cUSD) instead of native CELO. Wallets that support the field show
       * "Gas fee: 0.001 cUSD"; absent everywhere else.
       */
      fee_currency?: `0x${string}`
    }
  | {
      kind: 'evm-userop'
      user_op: UserOperation
      entry_point: `0x${string}`
      paymaster_url?: string
    }

// ---------- verifyTx ------------------------------------------------------

export interface VerifyTxArgs {
  /**
   * Event the producer expects. Omitted by webhook/polling producers —
   * they only know a signature touched the program; the adapter then
   * matches ANY escrow event in the transaction.
   */
  expected_event?: EscrowEvent
  /** Optional client hint — verified against decoded event payload. */
  escrow_id?: string
}

export interface DecodedEvent {
  name: EscrowEvent
  escrow_ref: string
  actor?: CaipAccountId
  /**
   * Action-specific fields decoded from the on-chain payload. All values are
   * stringified so u64/u256 amounts don't lose precision through JS `number`
   * (Number.MAX_SAFE_INTEGER < 2^53; SPL amounts are u64 up to 2^64). Each
   * event shape is defined alongside its decoder in `chains/<ns>/verify.ts`.
   */
  fields: Record<string, string>
}

export type VerifiedTx =
  | { confirmed: false; pending?: boolean; reason?: string }
  | { confirmed: true; failed: true; reason: string }
  | { confirmed: true; failed: false; event: DecodedEvent }

// ---------- escrow state snapshot -----------------------------------------

/**
 * Decoded on-chain escrow account state — a snapshot, not an event
 * (resolves open_issues.md §10.10). Field vocabulary matches the DB
 * `escrows` row so reconciliation can diff directly.
 */
export interface EscrowState {
  escrow_ref: string
  /** UUID string recovered from the on-chain 16-byte escrow_id. */
  escrow_id: string
  kind: 'gig' | 'exchange'
  /** SPL mint / ERC-20 address; null = native asset. */
  asset_address: string | null
  amount_raw: AmountRaw
  creator_address: string
  counterparty_address: string | null
  assigned_counterparty_address: string | null
  status:
    | 'open'
    | 'accepted'
    | 'submitted'
    | 'completed'
    | 'cancelled'
    | 'refunded'
    | 'disputed'
    | 'resolved'
  accept_deadline_unix: number
  completion_duration_seconds: number
  /** 0 until accepted. */
  completion_deadline_unix: number
  /** 0 until submitted. */
  approval_deadline_unix: number
  dispute_bond_raw: AmountRaw
  is_seeker: boolean
  created_at_unix: number
}

// ---------- auth-sig verify ----------------------------------------------

export interface VerifyAuthSigArgs {
  address: string
  /**
   * Raw auth-message string the user signed (Tenda-custom template — not
   * strict SIWS/SIWE; see stage-1 § Auth-message template).
   */
  message: string
  /** base64 (Solana) or 0x-hex (EVM). */
  signature: string
}

// ---------- adapter -------------------------------------------------------

export interface ChainAdapter {
  readonly namespace: ChainNamespace
  readonly chain_id: ChainId

  /** Build an unsigned transaction the client will sign. */
  buildTx(args: BuildTxArgs): Promise<UnsignedTx>

  /** Verify a confirmed tx + decode its event. Idempotent. */
  verifyTx(tx_ref: string, args: VerifyTxArgs): Promise<VerifiedTx>

  /** Verify the user's wallet-sig over the auth message. */
  verifyAuthSig(args: VerifyAuthSigArgs): Promise<boolean>

  /** Latest on-chain escrow state for reconciliation. Null = no account. */
  fetchEscrowState(escrow_ref: string): Promise<EscrowState | null>

  /**
   * Platform fee in raw units. Same surface as `lib/escrow.ts:computePlatformFee`
   * — adapter delegates to the shared implementation; lives on the interface so
   * adapter consumers don't have to import from two places.
   */
  computeFee(args: {
    amount_raw: AmountRaw
    is_seeker: boolean
    fee_bps: number
    seeker_fee_bps: number
  }): AmountRaw
}

// ---------- RPC + listener + push (split, used by Stage 2+) ---------------

export interface RpcProvider {
  readonly chain_id: ChainId
  /** Direct RPC fetch — reconciliation only, not request path. */
  getTransactionStatus(tx_ref: string): Promise<'unknown' | 'pending' | 'confirmed' | 'failed'>
}

export interface ChainListener {
  start(): Promise<void>
  stop(): Promise<void>
}

export interface PushService {
  /** Per-batch limit and provider-specific error mapping handled internally. */
  send(args: {
    tokens: ReadonlyArray<string>
    title: string
    body: string
    data?: Record<string, string>
  }): Promise<{
    ok: number
    failed: number
    /**
     * Tokens the provider reported as permanently GONE (Expo
     * DeviceNotRegistered / FCM UNREGISTERED / APNs 410) — callers prune
     * these from device_tokens. Transient failures are NOT included.
     */
    invalid_tokens: string[]
  }>
}

// ---------- registry shape (concrete instance in `chains/index.ts`) -------

export interface ChainRegistry {
  get(chain_id: ChainId): ChainAdapter
  has(chain_id: ChainId): boolean
  list(): ReadonlyArray<ChainAdapter>
}
