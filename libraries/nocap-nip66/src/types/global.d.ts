declare module '@nostrwatch/logger' {
  export default class Logger {
    constructor(name: string, log_level?: string, split_logs?: boolean);

    logger: createLogger.LoggerInstance;
    log_level: string;
    split_logs: boolean;

    fatal(message: string): void;
    error(message: string): void;
    err(message: string): void;
    warn(message: string): void;
    info(message: string): void;
    debug(message: string): void;
  }
}