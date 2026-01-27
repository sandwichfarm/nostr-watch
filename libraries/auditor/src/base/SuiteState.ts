import { EventEmitter } from "tseep";

export type ISuiteState = Map<string, any>

export class SuiteState {
    private state: ISuiteState = new Map();
    private emitter: EventEmitter;

    constructor(emitter?: EventEmitter){
        if(!emitter) return;
        this.emitter = emitter;
    }
    
    set<T>(key: string, value: T): void {
        this.state.set(key, value);
    }
    
    get<T>(key: string ): T | undefined {
        return this.state.get(key) ?? undefined;
    }

    push(key: string, value: any): void {
        const current = this.get(key);
        if(!Array.isArray(current)) {
            throw new Error('Value at key is not an array');
        }
        if(!current) {
            this.set(key, [value]);
        }
        else {
            current.push(value);
            this.set(key, current);
        }
    }

    add(key: string, value: any): void {
        const current = this.get(key);
        if(!(current instanceof Set)) {
            throw new Error('Value at key is not an array');
        }
        if(!current) {
            this.set(key, new Set([value]));
        }
        else {
            current.add(value);
            this.set(key, current);
        }
    }
}