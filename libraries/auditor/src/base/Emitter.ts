import { EventEmitter } from 'tseep'

export type Listener = (...args: any[]) => void

export class Emitter {
    public static emitter: EventEmitter = new EventEmitter();
    static on(event: string, listener: Listener): void {
        this.emitter.on(event, listener);
    }

    static emit(event: string, ...args: any[]): void {
        this.emitter.emit(event, ...args);
    }

    static off(event: string, listener: Listener): void {
        this.emitter.off(event, listener);
    }

    static once(event: string, listener: Listener): void {
        this.emitter.once(event, listener);
    }

    static removeAllListeners(event: string): void {
        this.emitter.removeAllListeners(event);
    }

    static listeners(event: string): Function[] {
        return this.emitter.listeners(event);
    }

    static listenerCount(event: string): number {
        return this.emitter.listenerCount(event);
    }
}