/**
 * Logging Infrastructure
 *
 * Centralized logging using pino
 */

import pino from 'pino'
import type { Logger as PinoLogger } from 'pino'
import { getConfig } from '../config.js'

let loggerInstance: PinoLogger | null = null

/**
 * Create logger instance
 */
function createLogger(): PinoLogger {
  const config = getConfig()

  if (!config.log.enabled) {
    // Return a no-op logger
    return pino({ level: 'silent' })
  }

  const options: pino.LoggerOptions = {
    level: config.log.level,
    base: {
      service: 'cvm',
      version: process.env.npm_package_version || '0.1.0',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  }

  // Configure transport based on destination
  let transport: pino.TransportSingleOptions | undefined

  if (config.log.destination === 'stdout' || config.log.destination === 'stderr') {
    // Pretty print for development
    transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
        destination: config.log.destination === 'stderr' ? 2 : 1,
      },
    }
  } else if (config.log.destination === 'file' && config.log.file) {
    // File output
    transport = {
      target: 'pino/file',
      options: {
        destination: config.log.file,
        mkdir: true,
      },
    }
  }

  return transport ? pino(options, pino.transport(transport)) : pino(options)
}

/**
 * Get logger singleton
 */
export function getLogger(): PinoLogger {
  if (!loggerInstance) {
    loggerInstance = createLogger()
  }
  return loggerInstance
}

/**
 * Create child logger with context
 */
export function createChildLogger(context: Record<string, any>): PinoLogger {
  return getLogger().child(context)
}

/**
 * Reset logger (for testing)
 */
export function resetLogger(): void {
  loggerInstance = null
}

/**
 * Re-export logger type
 */
export type Logger = PinoLogger
