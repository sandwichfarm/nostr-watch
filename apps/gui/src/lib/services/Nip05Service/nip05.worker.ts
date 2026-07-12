import type { Nip05 } from "nostr-tools/nip05";
import { verifyNip05 } from './verify-nip05';

self.onmessage = ({ data }) => {
    let { nip05 } = data;
    const { pubkey, timeoutMs } = data;
    
    if(!nip05.includes('@')){
        nip05 = `_@${nip05}`
    }
    
    verifyNip05(pubkey, nip05 as Nip05, { timeoutMs })
        .then((valid) => self.postMessage({ pubkey, nip05, valid }));
}
