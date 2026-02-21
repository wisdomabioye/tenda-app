import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { generateUploadSignature } from '../../../lib/cloudinary'
import type { UploadContract, ApiError } from '@tenda/shared'

type SignatureRoute = UploadContract['signature']

const upload: FastifyPluginAsync = async (fastify) => {
  // POST /v1/upload/signature — return Cloudinary signed params
  fastify.post<{
    Body: SignatureRoute['body']
    Reply: SignatureRoute['response'] | ApiError
  }>(
    '/signature',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { type } = request.body

      if (!type || (type !== 'avatar' && type !== 'proof')) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'type must be "avatar" or "proof"',
          code: ErrorCode.VALIDATION_ERROR,
        })
      }

      const signature = generateUploadSignature(type)
      return signature
    }
  )
}

export default upload
