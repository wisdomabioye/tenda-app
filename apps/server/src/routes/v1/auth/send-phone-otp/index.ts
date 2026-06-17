/**
 * POST /v1/auth/send-phone-otp — start phone verification (Stage 1,
 * decision #16: the phone gate guards the SOL gas seed, not app access).
 *
 * Body: { phone_e164 }. Rate limits + delivery live in lib/otp.ts.
 */

import type { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { sendOtp } from '@server/lib/otp'
import { buildOtpDeps } from '@server/lib/onboarding-deps'
import { hasVerifiedPhone } from '@server/lib/auth/resolver'

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

      if (await hasVerifiedPhone(fastify.db, request.user.id)) {
        throw new AppError(409, ErrorCode.PHONE_ALREADY_VERIFIED, 'phone already verified')
      }

      const result = await sendOtp(buildOtpDeps(fastify), {
        channel: 'phone',
        identifier: phone,
        user_id: request.user.id,
      })
      return reply.code(202).send(result)
    },
  )
}

export default route
