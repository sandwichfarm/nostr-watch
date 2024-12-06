import { INip11 } from '@nostrwatch/nip66/models';
import { nip11sLocal } from '$lib/stores/nip11s.js';

export class Nip11Service {
    worker: Worker;

    constructor(){
        this.worker = new Worker(new URL('./nip11.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = this.onmessage.bind(this);
    }
    
    check(relay: string): void {
        this.worker.postMessage({ relay })
    }

    private onmessage(message: MessageEvent){
        const { relay, nip11 } = message.data;
        nip11sLocal.update((map: Map<string, INip11>) => {
            map.set(relay, nip11)
            return map;
        });
    }
}