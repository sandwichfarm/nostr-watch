declare module 'logging' {
  interface LoggerInstance {
    error(message: string): void;
    warn(message: string): void;
    info(message: string): void;
    debug(message: string): void;
  }

  interface CreateLogger {
    (name: string): LoggerInstance;
    default?: (name: string) => LoggerInstance;
  }

  const createLogger: CreateLogger;

  export default createLogger;
}