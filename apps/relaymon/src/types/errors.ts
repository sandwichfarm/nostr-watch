/**
 * Error Type Utilities for RelayMon
 *
 * Provides type-safe error handling utilities and type guards.
 */

/**
 * Type guard to check if a value is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Safely extract error stack from unknown error
 */
export function getErrorStack(error: unknown): string | undefined {
  if (isError(error)) {
    return error.stack;
  }

  return undefined;
}

/**
 * Format error for logging
 */
export function formatError(error: unknown, context?: string): string {
  const message = getErrorMessage(error);
  const prefix = context ? `[${context}] ` : "";

  return `${prefix}${message}`;
}

/**
 * Custom error for relay check failures
 */
export class RelayCheckError extends Error {
  public readonly originalError?: unknown;

  constructor(
    message: string,
    public readonly relayUrl: string,
    public readonly checkType?: string,
    originalError?: unknown
  ) {
    super(message);
    this.name = "RelayCheckError";
    this.originalError = originalError;
  }
}

/**
 * Custom error for configuration issues
 */
export class ConfigError extends Error {
  public readonly originalError?: unknown;

  constructor(
    message: string,
    public readonly field?: string,
    originalError?: unknown
  ) {
    super(message);
    this.name = "ConfigError";
    this.originalError = originalError;
  }
}

/**
 * Custom error for database operations
 */
export class DatabaseError extends Error {
  public readonly originalError?: unknown;

  constructor(
    message: string,
    public readonly operation?: string,
    originalError?: unknown
  ) {
    super(message);
    this.name = "DatabaseError";
    this.originalError = originalError;
  }
}

/**
 * Custom error for publishing operations
 */
export class PublishError extends Error {
  public readonly originalError?: unknown;

  constructor(
    message: string,
    public readonly eventKind?: number,
    public readonly relayUrl?: string,
    originalError?: unknown
  ) {
    super(message);
    this.name = "PublishError";
    this.originalError = originalError;
  }
}

/**
 * Type guard for RelayCheckError
 */
export function isRelayCheckError(error: unknown): error is RelayCheckError {
  return error instanceof RelayCheckError;
}

/**
 * Type guard for ConfigError
 */
export function isConfigError(error: unknown): error is ConfigError {
  return error instanceof ConfigError;
}

/**
 * Type guard for DatabaseError
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}

/**
 * Type guard for PublishError
 */
export function isPublishError(error: unknown): error is PublishError {
  return error instanceof PublishError;
}
