import 'dotenv/config'
import Fastify from 'fastify'
import {app, options} from './app'
import { loadConfig } from './config'

const server = Fastify({
    // Trust the X-Forwarded-For header set by reverse proxies (Nginx, cloud LBs).
    // Required so rate limiting and logging use the real client IP, not the proxy IP.
    trustProxy: true,
    logger: {
        level: 'debug',
        transport: {
            target: 'pino-pretty'
        }
    }
})

const startServer = async () => {
  try {
    loadConfig();
    // Register your app
    await server.register(app, options)

    // Start listening
    await server.listen({ 
      port: 3000, 
      host: '0.0.0.0' 
    })

    const address = server.server.address()
    const port = typeof address === 'string' ? address : address?.port
    server.log.info(`Server listening on port ${port}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

// Handle graceful shutdown
// const gracefulShutdown = async (signal: string) => {
//   console.log(`Received ${signal}, closing server...`)
//   await server.close()
//   process.exit(0)
// }

// process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
// process.on('SIGINT', () => gracefulShutdown('SIGINT'))

startServer()