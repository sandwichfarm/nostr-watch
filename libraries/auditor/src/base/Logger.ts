import debug from 'debug';
import chalk, { ChalkInstance } from 'chalk';

type PredefinedLogLevel = 'debug' | 'info' | 'warn' | 'error';
type CustomLogLevel = string;
export type LogLevel = PredefinedLogLevel | CustomLogLevel;

export const LogLevelPriority: Record<string, number> = {
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
    success: 5,
    failure: 6,
};

export type LogColors = {
    [key in LogLevel]?: ChalkInstance;
};

type CustomLogger = {
    color: ChalkInstance;
    logLevel: LogLevel;
};

interface LoggerOptions {
    level?: LogLevel;
    colors?: Partial<LogColors>;
    showTimer?: boolean;
    showNamespace?: boolean;
}

export class Logger {
    private readonly namespace: string;
    private readonly debugInstance: debug.Debugger;
    private level: LogLevel;
    private colors: Required<LogColors>;
    private startTime: number;
    private customLoggers: Map<CustomLogLevel, CustomLogger>;
    private options: LoggerOptions;

    constructor(namespace: string, options: LoggerOptions = {}) {
        this.namespace = namespace;
        this.level = options.level ?? 'info';
        this.debugInstance = debug(namespace);
        this.startTime = Date.now();
        this.customLoggers = new Map();
        this.options = {
            showTimer: options.showTimer ?? true,
            showNamespace: options.showNamespace ?? true,
        };

        // Set default colors, override with user-provided colors
        this.colors = {
            debug: options.colors?.debug || chalk.gray,
            info: options.colors?.info || chalk.blue,
            warn: options.colors?.warn || chalk.yellow,
            error: options.colors?.error || chalk.red
        } as Required<LogColors>;
    }

    private shouldLog(level: LogLevel): boolean {
        return LogLevelPriority[level] >= LogLevelPriority[this.level];
    }

    private getElapsedSeconds(): string {
        const elapsedMs = Date.now() - this.startTime;
        const elapsedSeconds = (elapsedMs / 1000).toFixed(2);
        return `${elapsedSeconds}s`;
    }

    private formatMessage(level: LogLevel, message: string, indent: number): string {
        const parts = [];
        const indentation = ' '.repeat(indent * 2);

        if (this.options.showTimer) {
            parts.push(`[${this.getElapsedSeconds()}]`);
        }
        if (this.options.showNamespace) {
            parts.push(`[${this.namespace}]`);
        }
        parts.push(`${level.toUpperCase()}: ${message}`);
        return indentation + parts.join(' ');
    }

    private colorize(level: LogLevel, message: string): string {
        return this.colors[level](message);
    }

    private log(level: LogLevel, message: string, indent: number, ...args: unknown[]): void {
        if (!this.shouldLog(level)) return;

        const formattedMessage = this.formatMessage(level, message, indent);
        const coloredMessage = this.colorize(level, formattedMessage);

        if (level === 'debug') {
            this.debugInstance(coloredMessage, ...args);
        } else {
            console.log(coloredMessage, ...args);
        }
    }

    private logCustom(level: LogLevel, message: string, indent: number, ...args: unknown[]): void {
        this.log(level, message, indent, ...args);
    }

    reset(): void {
        this.startTime = Date.now();
    }

    setLevel(newLevel: LogLevel): void {
        this.level = newLevel;
    }

    info(message: string, indent: number = 0, ...args: unknown[]): void {
        this.log('info', message, indent, ...args);
    }

    warn(message: string, indent: number = 0, ...args: unknown[]): void {
        this.log('warn', message, indent, ...args);
    }

    error(message: string, indent: number = 0, ...args: unknown[]): void {
        this.log('error', message, indent, ...args);
    }

    debug(message: string, indent: number = 0, ...args: unknown[]): void {
        this.log('debug', message, indent, ...args);
    }

    registerLogger(name: CustomLogLevel, logLevel: LogLevel, color: ChalkInstance): void {
        this.customLoggers.set(name, { color, logLevel });
        LogLevelPriority[name] = LogLevelPriority[logLevel] ?? Object.keys(LogLevelPriority).length + 1;
        this.colors[name] = color;
    }

    custom(name: CustomLogLevel, message: string, indent: number = 0, ...args: unknown[]): void {
        const customLogger = this.customLoggers.get(name);
        if (customLogger && this.shouldLog(customLogger.logLevel)) {
            const formattedMessage = this.formatMessage(name, message, indent);
            const coloredMessage = customLogger.color(formattedMessage);

            console.log(coloredMessage, ...args);
        }
    }
}

export default Logger;