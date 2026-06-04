import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { getConnection } from '@server/lib/solana'
import { AppError } from '@server/lib/errors'
import { drizzleTxAttemptsStore, recordTxAttempt } from '@server/lib/tx-attempts'
import { isEscrowTxType } from '@server/chains/types'
import type { BlockchainContract, ApiError, TransactionStatus } from '@tenda/shared'

type TransactionRoute = BlockchainContract['transaction']

interface ClientPingBody {
  tx_ref?: unknown
  action?: unknown
  escrow_id?: unknown
  chain_id?: unknown
}

const transaction: FastifyPluginAsync = async (fastify) => {
  // POST /v1/blockchain/transaction — client-ping after broadcasting a tx
  // (cutover §3). Records the attempt in tx_attempts and enqueues the
  // idempotent verify-tx job; responds 202 immediately — verification is
  // never in the request path. Replays are no-ops (tx_ref UNIQUE + job_id
  // dedup), so the client can ping freely on retry.
  fastify.post<{ Body: ClientPingBody }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const body = request.body ?? {}
      if (typeof body.tx_ref !== 'string' || body.tx_ref === '') {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'tx_ref is required')
      }
      if (!isEscrowTxType(body.action)) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'action is not a known escrow action')
      }
      if (typeof body.chain_id !== 'string' || !fastify.chains.has(body.chain_id)) {
        throw new AppError(422, ErrorCode.VALIDATION_ERROR, 'chain_id is not registered')
      }
      const escrow_id =
        typeof body.escrow_id === 'string' && body.escrow_id !== '' ? body.escrow_id : null

      const adapter = fastify.chains.get(body.chain_id)
      const result = await recordTxAttempt(
        { store: drizzleTxAttemptsStore(fastify.db), queue: fastify.queue, log: request.log },
        {
          user_id: request.user.id,
          escrow_id,
          action: body.action,
          tx_ref: body.tx_ref,
          chain_id: body.chain_id,
          chain_ns: adapter.namespace,
        },
      )
      return reply.code(202).send({ status: 'queued', ...result })
    },
  )

  // GET /v1/blockchain/transaction/:signature — query Solana tx status
  // Requires auth to prevent unauthenticated callers from probing arbitrary signatures.
  // LEGACY: direct-RPC probe used by the current mobile TransactionMonitor.
  // Replaced by WS push + the POST ping above at the Stage-0 cutover (#34).
  fastify.get<{
    Params: TransactionRoute['params']
    Reply: TransactionRoute['response'] | ApiError
  }>('/:signature', { preHandler: [fastify.authenticate] }, async (request) => {
    const { signature } = request.params

    if (!signature) throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'signature parameter is required')

    try {
      const connection = getConnection()
      const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true })

      let txStatus: TransactionStatus['status'] = 'not_found'

      if (status.value) {
        if (status.value.err) {
          txStatus = 'failed'
        } else if (status.value.confirmationStatus === 'finalized') {
          txStatus = 'finalized'
        } else {
          txStatus = 'confirmed'
        }
      }

      return { signature, status: txStatus, block_time: undefined }
    } catch {
      throw new AppError(502, ErrorCode.INTERNAL_ERROR, 'Failed to query Solana network')
    }
  })
}

export default transaction
