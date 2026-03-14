// Managed by scripts/sync-idl.mjs — re-run after every `anchor build`
import _RAW from './tenda_escrow.json'
import type { TendaEscrow } from './tenda_escrow'

/** Compiled IDL for the Tenda Escrow program. Used by server (Anchor Program) and mobile (tx validation). */
export const ESCROW_IDL = _RAW as unknown as TendaEscrow

export type { TendaEscrow }

/**
 * Returns the 8-byte Anchor discriminator for the named instruction as a
 * plain number array. Portable across server (wrap with Buffer.from) and mobile.
 *
 * Throws if the instruction name is not found in the IDL — catches typos at dev time.
 */
export function discriminatorFor(instructionName: string): number[] {
  const instructions = (_RAW as { instructions: Array<{ name: string; discriminator: number[] }> }).instructions
  const ix = instructions.find((i) => i.name === instructionName)
  if (!ix) throw new Error(`Unknown instruction: ${instructionName}`)
  return ix.discriminator
}
