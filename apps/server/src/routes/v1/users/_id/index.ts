import { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import { users } from '@tenda/shared/db/schema'
import { ErrorCode, isCloudinaryUrl } from '@tenda/shared'
import type { UsersContract, ApiError } from '@tenda/shared'
import { ensureValidCoordinates } from '@server/lib/validation'
import { AppError } from '@server/lib/errors'
import { moderateBody } from '@server/lib/moderation'

type GetRoute    = UsersContract['get']
type UpdateRoute = UsersContract['update']

const userById: FastifyPluginAsync = async (fastify) => {
  // GET /v1/users/:id — public profile (no wallet_address)
  fastify.get<{
    Params: GetRoute['params']
    Reply: GetRoute['response'] | ApiError
  }>('/', async (request) => {
    const { id } = request.params

    const [user] = await fastify.db
      .select({
        id:               users.id,
        first_name:       users.first_name,
        last_name:        users.last_name,
        avatar_url:       users.avatar_url,
        bio:              users.bio,
        country:          users.country,
        city:             users.city,
        latitude:         users.latitude,
        longitude:        users.longitude,
        reputation_score: users.reputation_score,
        role:             users.role,
        is_seeker:        users.is_seeker,
        created_at:       users.created_at,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    if (!user) throw new AppError(404, ErrorCode.USER_NOT_FOUND, 'User not found')

    return user
  })

  // PUT /v1/users/:id — update own profile
  fastify.patch<{
    Params: UpdateRoute['params']
    Body: UpdateRoute['body']
    Reply: UpdateRoute['response'] | ApiError
  }>('/', { preHandler: [fastify.authenticate, moderateBody<UpdateRoute['body']>(fastify, ['bio'])] }, async (request) => {
    const { id } = request.params

    if (id !== request.user.id) throw new AppError(403, ErrorCode.FORBIDDEN, 'Can only update your own profile')

    const { first_name, last_name, avatar_url, bio, country, city, latitude, longitude } = request.body

    // Reject avatar URLs that don't come from Cloudinary CDN
    if (avatar_url !== undefined && avatar_url !== null && !isCloudinaryUrl(avatar_url)) {
      throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'avatar_url must be a Cloudinary URL (https://res.cloudinary.com/)')
    }

    ensureValidCoordinates(latitude, longitude)

    const updates: Record<string, unknown> = { updated_at: new Date() }
    if (first_name !== undefined) updates.first_name = first_name
    if (last_name !== undefined)  updates.last_name  = last_name
    if (avatar_url !== undefined) updates.avatar_url = avatar_url
    if (bio !== undefined)        updates.bio        = bio
    if (country !== undefined)    updates.country    = country
    if (city !== undefined)       updates.city       = city
    if (latitude !== undefined)   updates.latitude   = latitude
    if (longitude !== undefined)  updates.longitude  = longitude

    const [updated] = await fastify.db.update(users).set(updates).where(eq(users.id, id)).returning()

    return updated
  })
}

export default userById
