import type { nip11 } from 'nostr-tools';

import { get, type Writable } from 'svelte/store';

import type { Route66 } from '@nostrwatch/route66';
import { type Nip11 as Nip11Type, type RelayInformation } from '@nostrwatch/route66/models';

import { nip11sLocal } from '$lib/stores/nip11s.js';
import { setRelayError } from '$lib/stores/relay-errors.js';

import { instance } from '$lib/utils/lifecycle';
// import { relaysErrors } from '$lib/stores/relay-errors';

import PQueue from 'p-queue';
const queue = new PQueue({concurrency: 10});

export type Nip11ServiceMessage = {
    relay: string,
    nip11?: nip11.RelayInformation
    error?: any
}

type Nip11Constructor = new (info: RelayInformation) => Nip11Type;

type PendingRequest = {
    promise: Promise<Nip11Type | undefined>;
    resolve: (value: Nip11Type | undefined) => void;
    timeoutId: ReturnType<typeof setTimeout>;
};

export class Nip11Service {
    private worker: Worker | null = null;
    private pending = new Map<string, PendingRequest>();
    private nip11Ctor: Nip11Constructor | null = null;
    private nip11CtorPromise: Promise<Nip11Constructor> | null = null;

    constructor(){
        // Worker is created lazily on first request to improve load speed.
    }

    find(relay: string): Nip11Type | undefined {
        let $nip11sLocal: Map<string, Nip11Type> = get(nip11sLocal)
        return $nip11sLocal.get(relay)
    }
    
    async check(relay: string, options: { timeoutMs?: number } = {}): Promise<Nip11Type | undefined> {
        const timeoutMs = options.timeoutMs ?? 5_000;

        const existing = this.find(relay);
        if (existing) return existing;

        const inFlight = this.pending.get(relay);
        if (inFlight) return inFlight.promise;

        return queue.add(() => this.request(relay, timeoutMs));
    }

    private async request(relay: string, timeoutMs: number): Promise<Nip11Type | undefined> {
        const existing = this.find(relay);
        if (existing) return existing;

        const inFlight = this.pending.get(relay);
        if (inFlight) return inFlight.promise;

        const worker = this.ensureWorker();

        let resolveFn: (value: Nip11Type | undefined) => void = () => {};
        const promise = new Promise<Nip11Type | undefined>((resolve) => {
            resolveFn = resolve;
        });

        const timeoutId = setTimeout(() => {
            this.pending.delete(relay);
            resolveFn(undefined);
        }, timeoutMs);

        this.pending.set(relay, { promise, resolve: resolveFn, timeoutId });

        worker.postMessage({ relay });

        return promise;
    }

    private ensureWorker(): Worker {
        if (this.worker) return this.worker;
        this.worker = new Worker(new URL('./nip11.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = (message) => void this.onmessage(message as MessageEvent<Nip11ServiceMessage>);
        this.worker.onerror = () => {
            // Best-effort: resolve pending requests as undefined (errors already surfaced in UI stores).
            for (const [relay, pending] of this.pending.entries()) {
                clearTimeout(pending.timeoutId);
                pending.resolve(undefined);
                this.pending.delete(relay);
            }
        };
        return this.worker;
    }

    private async getNip11Ctor(): Promise<Nip11Constructor> {
        if (this.nip11Ctor) return this.nip11Ctor;
        if (!this.nip11CtorPromise) {
            this.nip11CtorPromise = import('@nostrwatch/route66/models')
                .then(({ Nip11 }) => {
                    this.nip11Ctor = Nip11 as unknown as Nip11Constructor;
                    return this.nip11Ctor;
                })
                .catch((e) => {
                    console.error('Error importing Nip11:', e);
                    throw e;
                });
        }
        return this.nip11CtorPromise;
    }

    private async onmessage(message: MessageEvent<Nip11ServiceMessage>){
        ////console.log('N11S recieved nip11 service message', message)
        const { relay, nip11:_nip11, error } = message.data;

        const pending = this.pending.get(relay);
        if (pending) {
            clearTimeout(pending.timeoutId);
            this.pending.delete(relay);
        }

        if (error) {
            setRelayError(relay, 'schema', 'nip11', error?.message ?? String(error));
            pending?.resolve(undefined);
            return;
        }
        if (!_nip11) {
            pending?.resolve(undefined);
            return;
        }

        const Nip11Ctor = await this.getNip11Ctor();
        const nip11 = new Nip11Ctor(_nip11 as RelayInformation);

        nip11sLocal.update((map: Map<string, Nip11Type>) => {
            map.set(relay, nip11);
            return map;
        });

        instance()
            .then(($route66: Route66) => {
                void $route66?.adapters?.cacheAdapter?.upsertNip11?.(relay, nip11.json);
            })
            .catch(() => {});

        pending?.resolve(nip11);
    }
}
