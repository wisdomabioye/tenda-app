import { FastifyPluginAsync } from 'fastify'
import { and, eq, sql } from 'drizzle-orm'
import { user_exchange_accounts } from '@tenda/shared/db/schema'
import { ErrorCode } from '@tenda/shared'
import { AppError } from '@server/lib/errors'
import { handleUniqueConflict } from '@server/lib/db'
import type { ExchangeAccountsContract, ApiError } from '@tenda/shared'

type ListRoute       = ExchangeAccountsContract['list']
type CreateRoute     = ExchangeAccountsContract['create']
type DeactivateRoute = ExchangeAccountsContract['deactivate']

const MAX_ACTIVE_ACCOUNTS = 10

const exchangeAccounts: FastifyPluginAsync = async (fastify) => {

  // GET /v1/exchange/accounts — list caller's payment accounts
  fastify.get<{
    Reply: ListRoute['response'] | ApiError
  }>('/', { preHandler: [fastify.authenticate] }, async (request) => {
    return fastify.db
      .select()
      .from(user_exchange_accounts)
      .where(
        and(
          eq(user_exchange_accounts.user_id, request.user.id),
          eq(user_exchange_accounts.is_active, true),
        )
      )
      .orderBy(user_exchange_accounts.created_at)
  })

  // POST /v1/exchange/accounts — add a new payment account
  fastify.post<{
    Body: CreateRoute['body']
    Reply: CreateRoute['response'] | ApiError
  }>(
    '/',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { method, account_name, account_number, bank_name, additional_info } = request.body

      if (!method?.trim() || !account_name?.trim() || !account_number?.trim()) {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'method, account_name, and account_number are required')
      }

      if (method.trim().length > 100)         throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'method must be at most 100 characters')
      if (account_name.trim().length > 100)   throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'account_name must be at most 100 characters')
      if (account_number.trim().length > 100) throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'account_number must be at most 100 characters')
      if (bank_name && bank_name.trim().length > 100) throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'bank_name must be at most 100 characters')
      if (additional_info && additional_info.trim().length > 500) throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'additional_info must be at most 500 characters')

      let account
      try {
        account = await fastify.db.transaction(async (tx) => {
          // Serialize concurrent creates for the same user; lock is released when
          // the transaction ends, so two simultaneous requests cannot both pass the
          // count check and insert a row that exceeds the cap.
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${request.user.id}::text))`)

          const [{ count }] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(user_exchange_accounts)
            .where(
              and(
                eq(user_exchange_accounts.user_id, request.user.id),
                eq(user_exchange_accounts.is_active, true),
              )
            )

          if (count >= MAX_ACTIVE_ACCOUNTS) {
            throw new AppError(
              409,
              ErrorCode.VALIDATION_ERROR,
              `You can have at most ${MAX_ACTIVE_ACCOUNTS} active payment accounts`,
            )
          }

          const [newAccount] = await tx
            .insert(user_exchange_accounts)
            .values({
              user_id:         request.user.id,
              method:          method.trim(),
              account_name:    account_name.trim(),
              account_number:  account_number.trim(),
              bank_name:       bank_name?.trim() || null,
              additional_info: additional_info?.trim() || null,
            })
            .returning()

          return newAccount
        })
      } catch (err) {
        // Re-throw AppError (from the max-account guard) directly
        if (err instanceof AppError) throw err
        handleUniqueConflict(err, ErrorCode.VALIDATION_ERROR, 'An account with this method and account number already exists')
      }

      return reply.code(201).send(account)
    }
  )

  // PATCH /v1/exchange/accounts/:id/deactivate — soft-disable an account
  fastify.patch<{
    Params: DeactivateRoute['params']
    Reply: DeactivateRoute['response'] | ApiError
  }>(
    '/:id/deactivate',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params

      const [account] = await fastify.db
        .update(user_exchange_accounts)
        .set({ is_active: false })
        .where(
          and(
            eq(user_exchange_accounts.id, id),
            eq(user_exchange_accounts.user_id, request.user.id),
          )
        )
        .returning()

      if (!account) {
        throw new AppError(404, ErrorCode.NOT_FOUND, 'Payment account not found')
      }

      return reply.send(account)
    }
  )
}

export default exchangeAccounts
