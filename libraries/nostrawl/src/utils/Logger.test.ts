import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Logger, { LogLevel } from './Logger';

describe('Logger', () => {
  // Mocking console methods
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'trace').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a logger with default settings', () => {
    const logger = new Logger();
    // Default level is now SILENT instead of INFO
    expect(logger.getLevel()).toBe(LogLevel.SILENT);
  });

  it('should create a logger with custom log level', () => {
    const logger = new Logger({ level: LogLevel.DEBUG });
    expect(logger.getLevel()).toBe(LogLevel.DEBUG);
  });

  it('should be able to change log level', () => {
    const logger = new Logger();
    logger.setLevel(LogLevel.ERROR);
    expect(logger.getLevel()).toBe(LogLevel.ERROR);
  });

  it('should log info messages when level is info', () => {
    const logger = new Logger({ level: LogLevel.INFO, timestamp: false });
    logger.info('test info message');
    expect(console.info).toHaveBeenCalled();
  });

  it('should not log debug messages when level is info', () => {
    const logger = new Logger({ level: LogLevel.INFO });
    logger.debug('test debug message');
    expect(console.debug).not.toHaveBeenCalled();
  });

  it('should log all levels when level is trace', () => {
    const logger = new Logger({ level: LogLevel.TRACE, timestamp: false });
    
    logger.trace('test trace message');
    logger.debug('test debug message');
    logger.info('test info message');
    logger.warn('test warn message');
    logger.error('test error message');
    
    expect(console.trace).toHaveBeenCalled();
    expect(console.debug).toHaveBeenCalled();
    expect(console.info).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it('should not log any messages when level is silent', () => {
    const logger = new Logger({ level: LogLevel.SILENT });
    
    logger.trace('test trace message');
    logger.debug('test debug message');
    logger.info('test info message');
    logger.warn('test warn message');
    logger.error('test error message');
    
    expect(console.trace).not.toHaveBeenCalled();
    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should create a child logger with inherited settings', () => {
    const parent = new Logger({ 
      level: LogLevel.DEBUG, 
      prefix: 'parent',
      timestamp: false
    });
    
    const child = parent.child('child');
    expect(child.getLevel()).toBe(LogLevel.DEBUG);
    
    child.debug('test child message');
    expect(console.debug).toHaveBeenCalled();
  });
}); 