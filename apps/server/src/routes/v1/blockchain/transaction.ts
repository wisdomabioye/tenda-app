import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { getConnection } from '@server/lib/solana'
import { AppError } from '@server/lib/errors'
import type { BlockchainContract, ApiError, TransactionStatus } from '@tenda/shared'

type TransactionRoute = BlockchainContract['transaction']

const transaction: FastifyPluginAsync = async (fastify) => {
  // GET /v1/blockchain/transaction/:signature — query Solana tx status
  // Requires auth to prevent unauthenticated callers from probing arbitrary signatures.
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
