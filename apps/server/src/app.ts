import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import {
  FastifyPluginAsync,
  FastifyServerOptions,
  FastifyError
} from 'fastify'
import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload'
import { ErrorCode } from '@tenda/shared'
import type { ApiError } from '@tenda/shared'
import { captureError } from './lib/reporter'
import { AppError } from './lib/errors'



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
      code: ErrorCode.INTERNAL_ERROR,
    }
    reply.code(404).send(error)
  })

  // Global error handler
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    // Structured application errors thrown by route helpers
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.errorLabel,
        message: error.message,
        code: error.code as ErrorCode,
      } satisfies ApiError)
    }

    const statusCode = error.statusCode ?? 500
    request.log.error(error)
    if (statusCode >= 500) captureError(error, { url: request.url, method: request.method })

    const response: ApiError = {
      statusCode,
      error: error.name || 'Internal Server Error',
      message: statusCode >= 500 ? 'An unexpected error occurred' : error.message,
      code: ErrorCode.INTERNAL_ERROR,
    }
    reply.code(statusCode).send(response)
  })

  // Load all plugins (db, auth, cors, rate-limit, sensible)
  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'plugins'),
    options: opts,
  })

  // Load all routes (v1/ folder structure handles prefixing).
  // routeParams: true converts _id directory names to :id URL parameters.
  void fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    options: opts,
    routeParams: true,
  })

  fastify.get('/', async (_request, reply) => {
    reply.send({ status: 'ok' })
  })

  // Android App Links verification file
  fastify.get('/.well-known/assetlinks.json', async (_request, reply) => {
    reply.type('application/json').send([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.tendahq.mobile',
          sha256_cert_fingerprints: [process.env.ANDROID_SHA256_FINGERPRINT ?? ''],
        },
      },
    ])
  })

  // Web fallback for shared gig links — redirects to app or Play Store
  fastify.get<{ Params: { id: string } }>('/gig/:id', async (request, reply) => {
    const { id } = request.params
    const deepLink = `tenda://gig/${id}`
    const storeUrl = 'https://play.google.com/store/apps/details?id=com.tendahq.mobile'
    reply.type('text/html').send(`<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Tenda — View Gig</title>
        <style>
          body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center;
                justify-content: center; min-height: 100vh; margin: 0; background: #fafaf8; color: #3d4d63; }
          a { color: #3b70c4; font-weight: 600; }
        </style>
      </head>
      <body>
        <p>Opening in Tenda…</p>
        <p>Don't have the app? <a href="${storeUrl}">Get it on Google Play</a></p>
        <script>
          window.location.replace('${deepLink}');
          setTimeout(function () { window.location.replace('${storeUrl}'); }, 2500);
        </script>
      </body>
      </html>`
    )
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
        code: ErrorCode.INTERNAL_ERROR,
      }
      reply.code(404).send(error)
    }
  })
}


export default app
export { app, options }
