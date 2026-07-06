/**
 * Builds the unsigned on-chain "resolve dispute" transaction. Shared by the
 * party-facing POST /v1/escrows/:id/resolve and the admin resolution
 * execute-build, so the two callers (different auth models) never duplicate
 * the raiser lookup + adapter dispatch.
 *
 * The on-chain resolve instruction routes the dispute bond by the RAISER's
 * identity, recovered here from the dispute record (one row per escrow).
 */
import { eq } from 'drizzle-orm'
import { disputes } from '@tenda/shared/db/schema/governance'
import { ErrorCode, type ResolutionWinner } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import type { AppDatabase } from '@server/plugins/db'
import type { ChainRegistry, UnsignedTx } from '@server/chains/types'

export interface BuildResolveTxDeps {
  db: AppDatabase
  chains: ChainRegistry
}

export interface BuildResolveTxArgs {
  escrow_id: string
  chain_id: string
  winner: ResolutionWinner
  /** The signing admin's user id (passed through to the adapter). */
  signer_user_id: string
}

export async function buildResolveTx(
  deps: BuildResolveTxDeps,
  args: BuildResolveTxArgs,
): Promise<UnsignedTx> {
  const [dispute] = await deps.db
    .select({ raised_by: disputes.raised_by })
    .from(disputes)
    .where(eq(disputes.escrow_id, args.escrow_id))
    .limit(1)
  if (dispute === undefined) {
    throw new AppError(
      409,
      ErrorCode.ESCROW_WRONG_STATUS,
      `escrow ${args.escrow_id} has no dispute record to resolve`,
    )
  }

  const adapter = deps.chains.get(args.chain_id)
  return adapter.buildTx({
    action: 'resolveDispute',
    user_id: args.signer_user_id,
    payload: { escrow_id: args.escrow_id, winner: args.winner, raiser_user_id: dispute.raised_by },
  })
}
