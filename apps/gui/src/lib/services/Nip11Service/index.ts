import { get } from 'svelte/store';
import type { nip11 } from 'nostr-tools';

import { nip11sLocal } from '$lib/stores/nip11s.js';
import type { INip11 } from '@nostrwatch/nip66/models';
import { getRelayErrorSubject, setRelayError, type RelayErrorMessages } from '$lib/stores/relay-errors.js';

export type Nip11ServiceMessage = {
    relay: string,
    nip11?: nip11.RelayInformation
    error?: any
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
        let error: RelayErrorMessages | undefined
        while(!result && !error){
            result = get(nip11sLocal).get(relay)
            error = getRelayErrorSubject(relay, 'nip11')
            await new Promise( resolve => setTimeout( resolve, 200 ))
        }
        return result ?? error;
    }

    private onmessage(message: MessageEvent<Nip11ServiceMessage>){
        const { relay, nip11, error } = message.data;
        if(error) {
            setRelayError(relay, 'nip11', error.message)
            return
        }
        nip11sLocal.update((map: Map<string, INip11>) => {
            let result: INip11[];
            if(map.has(relay)) {
                result = map.get(relay)
            }
            else {
                result = []
            }
            if(nip11) {
                result.push(nip11)
                map.set(relay, result)
            }
            return map;
        });
    }
}