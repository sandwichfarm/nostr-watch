import { get, type Writable } from 'svelte/store';
import type { nip11 } from 'nostr-tools';

import { nip11sLocal } from '$lib/stores/nip11s.js';
import { Nip11, type RelayInformation } from '@nostrwatch/nip66/models';
import { getRelayErrorSubject, setRelayError, type RelayErrorMessages } from '$lib/stores/relay-errors.js';
import { relaysErrors } from '$lib/stores/relay-errors';

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

    find(relay: string): Nip11 | undefined {
        let $nip11sLocal: Map<string, Nip11> = get(nip11sLocal)
        return $nip11sLocal.get(relay)
    }
    
    async check(relay: string): Promise<Nip11 | undefined> {
        this.worker.postMessage({ relay })
        let result: Nip11 | undefined; 
        let error: RelayErrorMessages | undefined
        while(!result && !error){
            result = (get(nip11sLocal) as Map<string, Nip11>)?.get(relay)
            error = getRelayErrorSubject(relay, 'nip11')
            await new Promise( resolve => setTimeout( resolve, 200 ))
        }
        return result;
    }

    private onmessage(message: MessageEvent<Nip11ServiceMessage>){
        console.log('N11S recieved nip11 service message', message)
        const { relay, nip11:_nip11, error } = message.data;
        const nip11 = new Nip11(_nip11 as RelayInformation)
        if(error) {
            console.log('N11S setting error in store', error.message)
            setRelayError(relay, 'nip11', error.message)
            return
        }
        nip11sLocal.update((map: Map<string, Nip11>) => {
            if(nip11) {
                map.set(relay, nip11)
            }
            return map;
        });
    }
}