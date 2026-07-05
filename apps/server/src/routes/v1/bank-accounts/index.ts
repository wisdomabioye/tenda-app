/**
 * /v1/bank-accounts (stage-8): GET list, POST create (NIP name-enquiry
 * when configured; rate-limited 5/min/user, the enquiry API is paid per
 * call).
 */

import type { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { drizzleBankAccountStore } from '@server/features/fiat-rails'
import { buildNameEnquiry } from '@server/lib/nip'
import { isPostgresUniqueViolation } from '@server/lib/db'
import { requireFiatRails, requireStr } from '@server/lib/fiat-routes'

const NG_ACCOUNT_RE = /^\d{10}$/

function serialize(a: {
  id: string
  country: string
  bank_code: string
  account_number: string
  account_name: string
  is_default: boolean
  verified_at: Date | null
  created_at: Date
}) {
  return {
    id: a.id,
    country: a.country,
    bank_code: a.bank_code,
    // Masked except the tail, full numbers never re-leave the API.
    account_number_masked: `****${a.account_number.slice(-4)}`,
    account_name: a.account_name,
    is_default: a.is_default,
    verified: a.verified_at !== null,
    created_at: a.created_at.toISOString(),
  }
}

interface CreateBody {
  country?: unknown
  bank_code?: unknown
  account_number?: unknown
  account_name?: unknown
  is_default?: unknown
}

const route: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [fastify.authenticate, requireFiatRails] }, async (request) => {
    const rows = await drizzleBankAccountStore(fastify.db).list(request.user.id)
    return rows.map(serialize)
  })

  fastify.post<{ Body: CreateBody }>(
    '/',
    {
      preHandler: [fastify.authenticate, requireFiatRails],
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const b = request.body ?? {}
      const country = requireStr('country', b.country, 2).toUpperCase()
      const bank_code = requireStr('bank_code', b.bank_code, 10)
      const account_number = requireStr('account_number', b.account_number, 20)
      if (country === 'NG' && !NG_ACCOUNT_RE.test(account_number)) {
        throw new AppError(422, ErrorCode.BANK_ACCOUNT_INVALID, 'NG account numbers are 10 digits')
      }

      // NIP name-enquiry when configured; otherwise the user-supplied name
      // saves unverified and the offramp provider re-validates on its side.
      const enquiry = buildNameEnquiry()
      let account_name: string
      let verified_at: Date | null = null
      if (enquiry !== null) {
        const resolved = await enquiry.lookup(bank_code, account_number)
        if (resolved === null) {
          throw new AppError(422, ErrorCode.BANK_ACCOUNT_INVALID, 'account did not resolve, check the number')
        }
        account_name = resolved
        verified_at = new Date()
      } else {
        account_name = requireStr('account_name', b.account_name, 200)
      }

      try {
        const row = await drizzleBankAccountStore(fastify.db).insert({
          user_id: request.user.id,
          country,
          bank_code,
          account_number,
          account_name,
          is_default: b.is_default === true,
          verified_at,
        })
        return reply.code(201).send(serialize(row))
      } catch (err) {
        if (isPostgresUniqueViolation(err)) {
          throw new AppError(409, ErrorCode.VALIDATION_ERROR, 'this bank account is already saved')
        }
        throw err
      }
    },
  )
}

export default route
