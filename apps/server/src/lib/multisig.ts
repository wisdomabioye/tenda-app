/**
 * Squads multisig helpers for the Solana `protocol_admin` 3-of-5 (decision #5).
 *
 * - `protocol_admin`: 3-of-5 Squads — fee_bps, treasury, approval_window,
 *   dispute_admin rotation, signer rotation.
 * - `dispute_admin`: SEPARATE single key at launch (decision #17). NOT
 *   handled by this module — routine dispute resolution is single-sig and
 *   lives in the resolve route.
 *
 * EVM Safe equivalents (Stage 3) live in `chains/evm/multisig.ts`.
 *
 * Status: signatures-only scaffold.
 *
 * Test coverage owed:
 *   - proposeTransaction returns a Squads tx PDA + serialized message
 *   - addSignature is idempotent per signer
 *   - executeWhenReady refuses below threshold; succeeds at 3/5
 *   - executeWhenReady is idempotent on the on-chain side
 */

export interface MultisigProposal {
  /** Squads transaction PDA. */
  tx_pda: string
  /** Serialized message bytes for signers to inspect off-chain. */
  message_b64: string
  threshold: number
  total_signers: number
}

export declare function proposeTransaction(args: {
  /** base64-encoded compiled instruction set. */
  instructions_b64: string
}): Promise<MultisigProposal>

export declare function addSignature(args: {
  tx_pda: string
  signer_pubkey: string
  signature_b64: string
}): Promise<{ collected: number; threshold: number }>

export declare function executeWhenReady(tx_pda: string): Promise<{ tx_ref: string }>
