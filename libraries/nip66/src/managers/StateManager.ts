import { LocalStorageWrapper } from "@base/core/LocalStorageWrapper";
import { EventEmitter } from "tseep";

export type StateAbort = {
    controller: AbortController;
    signal: AbortSignal;
};

export type StateStats = Map<string, number>;

export type UserPreferences = Map<string, any>

export type UserState = {
    pubkey?: string,
    authed?: boolean,
    profile?: any,
    relays?: string[]
    preferences?: UserPreferences
}

export class StateManager {
    private static _abortController: AbortController = new AbortController();
    private static _emitter: EventEmitter = new EventEmitter();
    private static _localStorage: LocalStorageWrapper = new LocalStorageWrapper("state")
    private static _enableStats: boolean = true;
    private static _stats: StateStats = new Map();
    private static _user: UserState = {}; 

    // Getter for the AbortController
    static get abortController(): AbortController {
        return this._abortController;
    }

    // Getter for the AbortSignal
    static get abortSignal(): AbortSignal {
        return this._abortController.signal;
    }

    // Abort action that emits an "abort" event
    static abort(): void {
        this.incrementStat('ac:abort');
        if (!this.abortSignal.aborted) {
            this._abortController.abort();
            this._emitter.emit("abort");
        }
    }

    // Check if aborted
    static aborted(): boolean {
        return this.abortSignal.aborted;
    }

    // Reset the AbortController and emit a "reset-abort" event
    static resetAbort(): void {
        this.incrementStat('ac:reset-abort');
        this._abortController = new AbortController();
        this._emitter.emit("reset-abort");
    }

    // Getter for LocalStorageWrapper
    static get localStorage(): LocalStorageWrapper {
        return this._localStorage;
    }

    // LocalStorageWrapper methods
    static set(key: string, value: any): void {
        this.incrementStat('ls:set');
        this.localStorage.setItem(key, value);
    }

    static get(key: string): any {
        this.incrementStat('ls:get');
        return this.localStorage.getItem(key);
    }

    static remove(key: string): void {
        this.incrementStat('ls:remove');
        this.localStorage.removeItem(key);
    }

    static clear(): void {
        this.incrementStat('ls:clear');
        this.localStorage.clear();
    }

    static size(): number {
        this.incrementStat('ls:size');
        return this.localStorage.length();
    }

    static key(index: number): string | null {
        this.incrementStat('ls:key');
        return this.localStorage.key(index);
    }

    // Getter for EventEmitter
    static get emitter(): EventEmitter {
        return this._emitter;
    }

    // Emit an event
    static emit(event: string, ...args: any[]): void {
        console.log(`emitting event: ${event}`);
        this.incrementStat('emitter:emit');
        this._emitter.emit(event, ...args);
    }

    // Add a listener for an event
    static on(event: string, listener: (...args: any[]) => void): void {
        this.incrementStat('emitter:on');
        this._emitter.on(event, listener);
    }

    // Add a one-time listener for an event
    static once(event: string, listener: (...args: any[]) => void): void {
        this.incrementStat('emitter:once');
        this._emitter.once(event, listener);
    }

    // Remove a listener for an event
    static off(event: string, listener?: (...args: any[]) => void): void {
        this.incrementStat('emitter:off');
        if (listener) {
            this._emitter.off(event, listener);
        } else {
            this._emitter.removeAllListeners(event);
        }
    }

    // Clear all listeners for a specific event
    static clearListeners(event: string): void {
        this.incrementStat('emitter:clear');
        this._emitter.removeAllListeners(event);
    }

    //internal
    static get stats(): Map<string, number> {
        return this._stats;
    }

    static enableStats(): void {
        this._enableStats = true;
    }

    static disableStats(): void {
        this._enableStats = false;
    }

    static incrementStat(key: string): void {
        if(this._enableStats) {
            const value = this.getStat(key);
            this.setStat(key, value + 1);
        }
    }

    static decrementStat(key: string): void {
        if(this._enableStats) {
            const value = this.getStat(key);
            this.setStat(key, value - 1);
        }
    }

    static clearStats(): void {
        this._stats.clear();
    }

    static setStat(key: string, value: number) {
        if(this._enableStats) 
            this._stats.set(key, value);
    }

    static getStat(key: string): number {
        if(!this._enableStats) return 0
        return this._stats.get(key) || 0;
    }
}