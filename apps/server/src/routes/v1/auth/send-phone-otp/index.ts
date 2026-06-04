/**
 * POST /v1/auth/send-phone-otp — start phone verification (Stage 1,
 * decision #16: the phone gate guards the SOL gas seed, not app access).
 *
 * Body: { phone_e164 }. Rate limits + delivery live in lib/otp.ts.
 */

import type { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { ErrorCode } from '@tenda/shared'
import { users } from '@tenda/shared/db/schema/identity'
import { AppError } from '@server/lib/errors'
import { sendPhoneOtp } from '@server/lib/otp'
import { buildOtpDeps } from '@server/lib/onboarding-deps'

interface Body {
  phone_e164?: unknown
}

const route: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: Body }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const phone = request.body?.phone_e164
      if (typeof phone !== 'string' || phone === '') {
        throw new AppError(422, ErrorCode.VALIDATION_ERROR, 'phone_e164 is required')
      }

      const rows = await fastify.db
        .select({ phone_verified_at: users.phone_verified_at })
        .from(users)
        .where(eq(users.id, request.user.id))
        .limit(1)
      if (rows[0]?.phone_verified_at != null) {
        throw new AppError(409, ErrorCode.PHONE_ALREADY_VERIFIED, 'phone already verified')
      }

      const result = await sendPhoneOtp(buildOtpDeps(fastify), {
        phone_e164: phone,
        user_id: request.user.id,
      })
      return reply.code(202).send(result)
    },
  )
}

export default route
