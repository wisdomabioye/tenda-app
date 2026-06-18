/**
 * POST /v1/auth/verify-phone-otp — confirm the code, then attach a VERIFIED
 * phone identity to the authenticated user (Stage 9: phone lives in
 * user_identities, not a users column). Runs the retroactive gas-seed check
 * (a user who skipped phone at signup and verifies later still receives the
 * seed for already-linked wallets).
 *
 * Legacy shim: the unified surface is POST /v1/auth/challenge + /verify
 * (method 'phone', authenticated). This route keeps the mobile contract until
 * Stage 9C. Collision (phone owned by another account) → IDENTITY_ALREADY_LINKED.
 *
 * Body: { phone_e164, code }.
 */

import type { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { verifyOtp } from '@server/lib/otp'
import { resolveOrLink } from '@server/lib/auth/orchestrator'
import { buildOtpDeps, fireRetroactiveGasSeed } from '@server/lib/onboarding-deps'

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

      // Prove control of the phone (the code was issued to THIS user's session).
      await verifyOtp(buildOtpDeps(fastify), {
        channel: 'phone',
        identifier: phone,
        code,
        user_id: request.user.id,
      })

      // Attach the verified phone identity — the orchestrator blocks if the
      // phone already belongs to another account (IDENTITY_ALREADY_LINKED).
      await resolveOrLink(
        fastify.db,
        { type: 'identity', identity: { kind: 'phone', identifier: phone, email: null } },
        request.user.id,
      )

      // Retroactive seed for any already-linked wallets (shared trigger).
      fireRetroactiveGasSeed(fastify, request.user.id)

      return { verified: true }
    },
  )
}

export default route
