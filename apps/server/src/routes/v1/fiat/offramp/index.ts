/**
 * POST /v1/fiat/offramp { intent_id, bank_account_id }, initiate a quoted
 * offramp (stage-8 § Offramp pipeline step 5). Returns the provider's
 * DepositInstruction; the user signs the USDC/SOL transfer themselves.
 */

import type { FastifyPluginAsync } from 'fastify'
import { ErrorCode, payoutCurrencyForCountry } from '@tenda/shared'
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
      if (intent !== null && intent.user_id === request.user.id) {
        if (intent.direction !== 'offramp') {
          throw new AppError(422, ErrorCode.VALIDATION_ERROR, 'intent is not an offramp')
        }
        // The account is persisted on the P2P offer as the buyer's payout
        // target, so its currency must match the offer the intent was quoted
        // in — a KES account can't back an NGN cash-out. Mirrors the guard on
        // the manual create route (routes/v1/exchange).
        if (payoutCurrencyForCountry(account.country) !== intent.fiat_currency) {
          throw new AppError(
            422,
            ErrorCode.VALIDATION_ERROR,
            'payout account currency does not match the offramp currency',
          )
        }
      }
      return initiateIntent(deps, request.user.id, intent_id, {
        bank_account: {
          bank_code: account.bank_code,
          account_number: account.account_number,
          account_name: account.account_name,
        },
        // Persisted on the P2P offer so an accepted buyer sees where to pay.
        payout_account_id: account.id,
      })
    },
  )
}

export default route
