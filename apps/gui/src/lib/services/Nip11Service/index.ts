import { get } from 'svelte/store';
import type { nip11 } from 'nostr-tools';

import { nip11sLocal } from '$lib/stores/nip11s.js';
import type { INip11 } from '@nostrwatch/nip66/models';

export type Nip11ServiceMessage = {
    relay: string,
    nip11: nip11.RelayInformation
}

export class Nip11Service {
    worker: Worker;

    constructor(){
        this.worker = new Worker(new URL('./nip11.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = this.onmessage.bind(this);
    }

    find(relay: string): INip11 | undefined {
        let $nip11sLocal = get(nip11sLocal)
        return $nip11sLocal.get(relay)
    }
    
    async check(relay: string): Promise<INip11> {
        this.worker.postMessage({ relay })
        let result: Nip11ServiceMessage | undefined; 
        while(!result){
            result = get(nip11sLocal).get(relay)
            await new Promise( resolve => setTimeout( resolve, 200 ))
        }
        return result;
    }

    private onmessage(message: MessageEvent<Nip11ServiceMessage>){
        const { relay, nip11 } = message.data;
        nip11sLocal.update((map: Map<string, INip11>) => {
            map.set(relay, nip11)
            return map;
        });
    }
}