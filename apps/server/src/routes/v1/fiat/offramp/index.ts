/**
 * POST /v1/fiat/offramp { intent_id, bank_account_id } — initiate a quoted
 * offramp (stage-8 § Offramp pipeline step 5). Returns the provider's
 * DepositInstruction; the user signs the USDC/SOL transfer themselves.
 */

import type { FastifyPluginAsync } from 'fastify'
import { ErrorCode } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { buildFiatDeps, initiateIntent, drizzleBankAccountStore } from '@server/features/fiat-rails'
import { requireFiatRails, requireStr } from '@server/lib/fiat-routes'

const route: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { intent_id?: unknown; bank_account_id?: unknown } }>(
    '/',
    {
      preHandler: [fastify.authenticate, requireFiatRails],
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request) => {
      const intent_id = requireStr('intent_id', request.body?.intent_id, 100)
      const bank_account_id = requireStr('bank_account_id', request.body?.bank_account_id, 100)

      const account = await drizzleBankAccountStore(fastify.db).get(request.user.id, bank_account_id)
      if (account === null) {
        throw new AppError(404, ErrorCode.NOT_FOUND, 'bank account not found')
      }

      const deps = await buildFiatDeps(fastify)
      const intent = await deps.store.getIntent(intent_id)
      if (intent !== null && intent.user_id === request.user.id && intent.direction !== 'offramp') {
        throw new AppError(422, ErrorCode.VALIDATION_ERROR, 'intent is not an offramp')
      }
      return initiateIntent(deps, request.user.id, intent_id, {
        bank_account: {
          bank_code: account.bank_code,
          account_number: account.account_number,
          account_name: account.account_name,
        },
      })
    },
  )
}

export default route
