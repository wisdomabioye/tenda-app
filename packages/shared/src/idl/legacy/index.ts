// LEGACY IDL — the pre-rewrite gig program still deployed on devnet.
// Consumed ONLY by the legacy surface (apps/server/src/lib/solana.ts, legacy
// mobile wallet validation) until the Stage-0 cutover (#34) deploys the new
// program and deletes this directory together with its consumers.
import _RAW from './tenda_escrow.json'
import type { TendaEscrow } from './tenda_escrow'

/** Compiled IDL for the Tenda Escrow program. Used by server (Anchor Program) and mobile (tx validation). */
export const ESCROW_IDL = _RAW as unknown as TendaEscrow

export type { TendaEscrow }

/** Union of all valid instruction names in the Tenda Escrow program. */
export type InstructionName =
  | 'create_gig_escrow'
  | 'accept_gig'
  | 'submit_proof'
  | 'approve_completion'
  | 'cancel_gig'
  | 'refund_expired'
  | 'dispute_gig'
  | 'resolve_dispute'
  | 'withdraw_earnings'
  | 'create_user_account'
  | 'airdrop_gas_subsidy'
  | 'batch_airdrop_gas_subsidy'

/**
 * Returns the 8-byte Anchor discriminator for the named instruction as a
 * plain number array. Portable across server (wrap with Buffer.from) and mobile.
 *
 * Throws if the instruction name is not found in the IDL — catches typos at dev time.
 */
export function discriminatorFor(instructionName: InstructionName): number[] {
  const instructions = (_RAW as { instructions: Array<{ name: string; discriminator: number[] }> }).instructions
  const ix = instructions.find((i) => i.name === instructionName)
  if (!ix) throw new Error(`Unknown instruction: ${instructionName}`)
  return ix.discriminator
}
