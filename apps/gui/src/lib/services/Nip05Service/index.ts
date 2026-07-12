import type { Nip05 } from 'nostr-tools/nip05';
import { generateNip05MapKey, type INip05Map, type INip05Result, nip05s } from '$lib/stores/nip05s.js';
import { get } from 'svelte/store';

export type PubkeyNip05PairsType = {
    pubkey: string,
    nip05: Nip05
}

type PendingRequest = {
    promise: Promise<INip05Result>;
    resolve: (value: INip05Result) => void;
    timeoutId: ReturnType<typeof setTimeout>;
};

export class Nip05Service {
    private worker: Worker | null = null;
    private pending = new Map<string, PendingRequest>();

    constructor(){
        // Worker is created lazily on first request to improve load speed.
    }

    find(pubkey: string, nip05: Nip05): INip05Result | undefined {
        const $nip05s: INip05Map = get(nip05s)
        const key = generateNip05MapKey(pubkey, nip05)
        return $nip05s.get(key)
    }
    
    async check(pubkey: string, nip05: Nip05, options: { timeoutMs?: number } = {}): Promise<INip05Result> {
        const timeoutMs = options.timeoutMs ?? 10_000;
        const key = generateNip05MapKey(pubkey, nip05)
        const existing = this.find(pubkey, nip05);
        if (existing) return existing;

        const inFlight = this.pending.get(key);
        if (inFlight) return inFlight.promise;

        const worker = this.ensureWorker();

        let resolveFn: (value: INip05Result) => void = () => {};
        const promise = new Promise<INip05Result>((resolve) => {
            resolveFn = resolve;
        });

        const timeoutId = setTimeout(() => {
            this.pending.delete(key);
            resolveFn({ pubkey, nip05, valid: false });
        }, timeoutMs);

        this.pending.set(key, { promise, resolve: resolveFn, timeoutId });
        worker.postMessage({ pubkey, nip05, timeoutMs });
        return promise;
    }

    async valid(pubkey: string, nip05: Nip05){
        let exists = this.find(pubkey, nip05)
        if(exists){
            return exists.valid;
        }
        return (await this.check(pubkey, nip05)).valid;
    }

    private ensureWorker(): Worker {
        if (this.worker) return this.worker;
        this.worker = new Worker(new URL('./nip05.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = (message) => this.onmessage(message as MessageEvent<INip05Result>);
        this.worker.onerror = () => {
            for (const [key, pending] of this.pending.entries()) {
                clearTimeout(pending.timeoutId);
                // Best-effort default on worker failure.
                const parts = key.split(':');
                const nip05 = parts[0] as Nip05;
                const pubkey = parts.slice(1).join(':');
                pending.resolve({ pubkey, nip05, valid: false });
                this.pending.delete(key);
            }
        };
        return this.worker;
    }

    private onmessage(message: MessageEvent<INip05Result>){
        const { pubkey, nip05, valid } = message.data;
        const key = generateNip05MapKey(pubkey, nip05);
        const pending = this.pending.get(key);
        if (pending) {
            clearTimeout(pending.timeoutId);
            this.pending.delete(key);
            pending.resolve({ pubkey, nip05, valid });
        }
        nip05s.update((map: INip05Map) => {
            map.set( generateNip05MapKey(pubkey, nip05), { pubkey, nip05, valid } );
            return map;
        });
    }
}
