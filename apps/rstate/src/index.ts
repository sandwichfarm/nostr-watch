/**
 * CVM Main Entry Point
 *
 * Starts the ContextVM server with graceful shutdown
 */

// Load environment variables from .env file
import 'dotenv/config'

// Polyfill WebSocket for Node.js environment
// Node.js v20+ has WebSocket built-in, but it needs to be made available globally
// for libraries that expect it (like applesauce-relay via rxjs)
import { WebSocket } from 'ws'
if (typeof globalThis.WebSocket === 'undefined') {
  // @ts-ignore - WebSocket types are compatible
  globalThis.WebSocket = WebSocket
}

import { getConfig } from './config.js'
import { getLogger } from './utils/logger.js'
import { CVMServer } from './server.js'

const logger = getLogger().child({ module: 'main' })

/**
 * Main function
 */
async function main(): Promise<void> {
  logger.info('Starting RelayVM')

  let server: CVMServer | null = null

  try {
    // Load configuration
    const config = getConfig()
    logger.info('Configuration loaded')

    // Create server
    server = new CVMServer(config)

    // Set up graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal')

      if (server) {
        try {
          await server.stop()
          logger.info('Shutdown complete')
          process.exit(0)
        } catch (err) {
          logger.error({ err }, 'Error during shutdown')
          process.exit(1)
        }
      } else {
        process.exit(0)
      }
    }

    // Register signal handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))

    // Handle uncaught errors
    process.on('uncaughtException', (err) => {
      const message = (err && typeof err === 'object' && 'message' in err) ? String((err as any).message) : String(err)
      const stack = (err && typeof err === 'object' && 'stack' in err) ? String((err as any).stack) : undefined
      // Log with pino and also to stderr to avoid JSON serialization edge cases
      logger.fatal({ message, stack }, 'Uncaught exception')
      try { console.error('Uncaught exception:', message, '\n', stack) } catch {}
      process.exit(1)
    })

    process.on('unhandledRejection', (reason) => {
      const message = (reason && typeof reason === 'object' && 'message' in reason) ? String((reason as any).message) : String(reason)
      const stack = (reason && typeof reason === 'object' && 'stack' in reason) ? String((reason as any).stack) : undefined
      logger.fatal({ message, stack }, 'Unhandled rejection')
      try { console.error('Unhandled rejection:', message, '\n', stack) } catch {}
      process.exit(1)
    })

    // Start server
    await server.start()

    logger.info('CVM is running. Press Ctrl+C to stop.')
  } catch (err) {
    logger.fatal({ err }, 'Failed to start CVM')
    process.exit(1)
  }
}

// Run main
main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
