/**
 * POST /v1/auth/verify-phone-otp — confirm the code, mark
 * users.phone_verified_at, then run the retroactive gas-seed check
 * (stage-1: a user who skipped phone at signup and verifies later still
 * receives the seed for already-linked wallets).
 *
 * Body: { phone_e164, code }.
 */

import type { FastifyPluginAsync } from 'fastify'
import { and, eq, ne } from 'drizzle-orm'
import { ErrorCode } from '@tenda/shared'
import { users } from '@tenda/shared/db/schema-v2/identity'
import { AppError } from '@server/lib/errors'
import { verifyPhoneOtp } from '@server/lib/otp'
import { dispatchGasSeeds } from '@server/lib/gas-seed'
import { buildGasSeedDeps, buildOtpDeps } from '@server/lib/onboarding-deps'

interface Body {
  phone_e164?: unknown
  code?: unknown
}

const route: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: Body }>(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const phone = request.body?.phone_e164
      const code = request.body?.code
      if (typeof phone !== 'string' || phone === '' || typeof code !== 'string' || code === '') {
        throw new AppError(422, ErrorCode.VALIDATION_ERROR, 'phone_e164 and code are required')
      }

      // Phone numbers are unique account anchors — refuse a phone another
      // account already verified BEFORE burning the OTP attempt.
      const taken = await fastify.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.phone_e164, phone), ne(users.id, request.user.id)))
        .limit(1)
      if (taken.length > 0) {
        throw new AppError(
          409,
          ErrorCode.VALIDATION_ERROR,
          'phone number is already verified on another account',
        )
      }

      await verifyPhoneOtp(buildOtpDeps(fastify), {
        phone_e164: phone,
        code,
        user_id: request.user.id,
      })

      await fastify.db
        .update(users)
        .set({ phone_e164: phone, phone_verified_at: new Date() })
        .where(eq(users.id, request.user.id))

      // Retroactive seed: fire-and-forget — verification must not block on
      // an RPC transfer; failures are logged and retried on next link.
      void dispatchGasSeeds(buildGasSeedDeps(fastify), request.user.id).catch((err) =>
        fastify.log.warn({ err, user_id: request.user.id }, 'retroactive gas seed failed'),
      )

      return { verified: true }
    },
  )
}

export default route
