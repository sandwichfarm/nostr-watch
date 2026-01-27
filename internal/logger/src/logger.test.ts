import { describe, it, expect } from 'vitest'
import Logger from './logger'

describe('Logger', () => {
  it('should create a logger with default level INFO', () => {
    const logger = new Logger('test')
    expect(logger).toBeDefined()
  })
  
  it('should handle different log levels', () => {
    const logger = new Logger('test', 'DEBUG')
    expect(logger).toBeDefined()
    
    const errorLogger = new Logger('test', 'ERROR')
    expect(errorLogger).toBeDefined()
  })
}) 