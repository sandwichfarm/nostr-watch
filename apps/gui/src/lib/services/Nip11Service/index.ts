import type { nip11 } from 'nostr-tools';

import { get, type Writable } from 'svelte/store';

import type { Route66 } from '@nostrwatch/route66';
import { type Nip11 as Nip11Type, type RelayInformation } from '@nostrwatch/route66/models';

import { nip11sLocal } from '$lib/stores/nip11s.js';
import { getRelayErrorSubject, setRelayError, type RelayErrorMessages } from '$lib/stores/relay-errors.js';

import { instance } from '$lib/utils/lifecycle';
// import { relaysErrors } from '$lib/stores/relay-errors';

import PQueue from 'p-queue';
const queue = new PQueue({concurrency: 10});

let Nip11: typeof Nip11Type;
import('@nostrwatch/route66/models')
    .then(({Nip11:Nip11_}) => {
        Nip11 = Nip11_;
    })
    .catch((e) => {
        console.error('Error importing Nip11:', e);
    });

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
        queue.add(async () => {
            this.worker.postMessage({ relay })
            let result: Nip11 | undefined; 
            let error: RelayErrorMessages | undefined
            while(!result && !error){
                result = (get(nip11sLocal) as Map<string, Nip11>)?.get(relay)
                error = getRelayErrorSubject(relay, 'resolve', 'nip11')
                await new Promise( resolve => setTimeout( resolve, 200 ))
            }
            return result;
        });
    }

    private onmessage(message: MessageEvent<Nip11ServiceMessage>){
        ////console.log('N11S recieved nip11 service message', message)
        const { relay, nip11:_nip11, error } = message.data;
        const nip11 = new Nip11(_nip11 as RelayInformation)
        if(error) {
            setRelayError(relay, 'schema', 'nip11', error.message)
            return
        }
        nip11sLocal.update((map: Map<string, Nip11>) => {
            if(nip11) {
                map.set(relay, nip11)
            }
            return map;
        });
        instance().then( ($route66: Route66) => {
            void $route66?.adapters?.cacheAdapter?.upsertNip11?.(relay, nip11.json)
        })
    }
}
