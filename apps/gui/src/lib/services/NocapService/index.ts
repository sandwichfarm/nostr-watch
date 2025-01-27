import { get, writable, type Writable } from 'svelte/store';
import { type CheckKey } from "@nostrwatch/nocap"

export type NocapRequestMessage = {
    relay: string,
    checks: CheckKey[]
}

export type NocapResultMessage = {
    relay: string,
    results?: any,
    error?: any
}

export type NocapResultMap = Map<string, any>

const nocapResults: Writable<NocapResultMap> = writable(new Map())

export class NocapService {
    worker: Worker;

    constructor(){
        this.worker = new Worker(new URL('./nocap.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = this.onmessage.bind(this);
    }

    async check(relay: string, checks: string | string[] = 'open'): Promise<any | undefined> {
        // console.log('checking', relay)
        this.worker.postMessage({ relay, checks } as NocapRequestMessage)
        // console.log('message posted', { relay, checks })
        let result: any | undefined;
        while(!result){
            result = get(nocapResults).get(relay)
            await new Promise( resolve => setTimeout( resolve, 200 ))
        }
        return result;
    }

    private onmessage(message: MessageEvent<NocapResultMessage>){
        const { relay, results } = message.data;
        nocapResults.update((map: NocapResultMap) => {
            map.set( relay, results );
            return map;
        });
    }
}