declare module '@nostrwatch/logger' {
  export default class Logger {
    constructor(namespace: string);
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
  }
} 