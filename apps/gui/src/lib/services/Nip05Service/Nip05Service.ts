import type { Nip05 } from 'nostr-tools/nip05';
import { type INip05Map, nip05Results } from '$lib/stores/nip05.js';

export class Nip05Service {
    worker: Worker;

    constructor(){
        this.worker = new Worker(new URL('./nip05.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = this.onmessage.bind(this);
    }
    
    check(pubkey: string, value: Nip05): void {
        this.worker.postMessage({ pubkey, nip05: value})
    }

    private onmessage(message: MessageEvent){
        const { pubkey, nip05, result } = message.data;
        nip05Results.update((map: INip05Map) => {
            map.set(nip05, { pubkey, nip05, valid: result });
            return map;
        });
    }
}