import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { 
  FastifyPluginAsync, 
  FastifyServerOptions, 
  FastifyError 
} from 'fastify'
import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload'
import type { ApiError } from '@tenda/shared'



export interface AppOptions extends FastifyServerOptions, Partial<AutoloadPluginOptions> {}

const options: AppOptions = {}

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts
): Promise<void> => {
  // 404 handler
  fastify.setNotFoundHandler((request, reply) => {
    const error: ApiError = {
      statusCode: 404,
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
    }
    reply.code(404).send(error)
  })

  // Global error handler
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode ?? 500

    request.log.error(error)

    const response: ApiError = {
      statusCode,
      error: error.name || 'Internal Server Error',
      message: statusCode >= 500 ? 'An unexpected error occurred' : error.message,
    }
    reply.code(statusCode).send(response)
  })

  // Load all plugins (db, auth, cors, rate-limit, sensible)
  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'plugins'),
    options: opts,
  })

  // Load all routes (v1/ folder structure handles prefixing)
  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    options: opts,
  })

  fastify.get('/favicon.ico', async (request, reply) => {
    try {
      const filePath = join(__dirname, 'assets', 'favicon.png')
      const buffer = await readFile(filePath)
      reply.type('image/png').send(buffer)
    } catch {
      const error: ApiError = {
        statusCode: 404,
        error: 'Not Found',
        message: 'favicon.png not found',
      }
      reply.code(404).send(error)
    }
  })
}


export default app
export { app, options }
