import { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { generateUploadSignature } from '@server/lib/cloudinary'
import { AppError } from '@server/lib/errors'
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
    async (request) => {
      const { type } = request.body

      if (!type || (type !== 'avatar' && type !== 'proof')) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'type must be "avatar" or "proof"')
      }

      return generateUploadSignature(type)
    }
  )
}

export default upload
