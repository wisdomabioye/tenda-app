import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { getConnection } from '../../../lib/solana'
import type { BlockchainContract, ApiError, TransactionStatus } from '@tenda/shared'

type TransactionRoute = BlockchainContract['transaction']

const transaction: FastifyPluginAsync = async (fastify) => {
  // GET /v1/blockchain/transaction/:signature — query Solana tx status
  fastify.get<{
    Params: TransactionRoute['params']
    Reply: TransactionRoute['response'] | ApiError
  }>('/:signature', async (request, reply) => {
    const { signature } = request.params

    if (!signature) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'signature parameter is required',
        code: ErrorCode.VALIDATION_ERROR,
      })
    }

    try {
      const connection = getConnection()
      const status = await connection.getSignatureStatus(signature)

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

      return {
        signature,
        status: txStatus,
        block_time: undefined,
      }
    } catch {
      return reply.code(502).send({
        statusCode: 502,
        error: 'Bad Gateway',
        message: 'Failed to query Solana network',
        code: ErrorCode.INTERNAL_ERROR,
      })
    }
  })
}

export default transaction
