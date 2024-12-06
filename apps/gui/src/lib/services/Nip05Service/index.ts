import type { Nip05 } from 'nostr-tools/nip05';
import { generateNip05MapKey, type INip05Map, type INip05Result, nip05s } from '$lib/stores/nip05s.js';
import { get } from 'svelte/store';

export type PubkeyNip05PairsType = {
    pubkey: string,
    nip05: Nip05
}

export class Nip05Service {
    worker: Worker;

    constructor(){
        this.worker = new Worker(new URL('./nip05.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = this.onmessage.bind(this);
    }

    find(pubkey: string, nip05: Nip05): INip05Result | undefined {
        const key = generateNip05MapKey(pubkey, nip05)
        let n05s = get(nip05s)
        let result = n05s.get(key)
        return result
    }
    
    async check(pubkey: string, nip05: Nip05): Promise<INip05Result> {
        const key = generateNip05MapKey(pubkey, nip05)
        this.worker.postMessage({ pubkey, nip05 })
        let result: INip05Result | undefined;
        while(!result){
            result = get(nip05s).get(key)
            await new Promise( resolve => setTimeout( resolve, 200 ))
        }
        return result;
    }

    async valid(pubkey: string, nip05: Nip05){
        let exists = this.find(pubkey, nip05)
        if(exists){
            return exists.valid;
        }
        return (await this.check(pubkey, nip05)).valid;
    }

    private onmessage(message: MessageEvent<INip05Result>){
        const { pubkey, nip05, valid } = message.data;
        nip05s.update((map: INip05Map) => {
            map.set( generateNip05MapKey(pubkey, nip05), { pubkey, nip05, valid } );
            return map;
        });
    }
}