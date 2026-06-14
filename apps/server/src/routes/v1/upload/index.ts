import { FastifyPluginAsync } from 'fastify'
import { and, eq, or } from 'drizzle-orm'
import { conversations } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { generateUploadSignature } from '@server/lib/cloudinary'
import { AppError, requireBody } from '@server/lib/errors'
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
      const { type, conversation_id } = requireBody(request.body)

      if (!type || (type !== 'avatar' && type !== 'proof' && type !== 'chat')) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'type must be "avatar", "proof" or "chat"')
      }

      // S5.2: chat uploads are scoped to a conversation the caller belongs
      // to — membership checked BEFORE a signature is issued.
      if (type === 'chat') {
        if (typeof conversation_id !== 'string' || conversation_id === '') {
          throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'conversation_id is required for chat uploads')
        }
        const member = await fastify.db
          .select({ id: conversations.id })
          .from(conversations)
          .where(
            and(
              eq(conversations.id, conversation_id),
              or(
                eq(conversations.user_a_id, request.user.id),
                eq(conversations.user_b_id, request.user.id),
              ),
            ),
          )
          .limit(1)
        if (member.length === 0) {
          throw new AppError(403, ErrorCode.FORBIDDEN, 'not a member of this conversation')
        }
        return generateUploadSignature('chat', request.user.id, conversation_id)
      }

      return generateUploadSignature(type, type === 'proof' ? request.user.id : undefined)
    }
  )
}

export default upload
