import { nip05 } from "nostr-tools";
import type { Nip05 } from "nostr-tools/nip05";

const check = (pubkey: string, value: Nip05) => {
    if(nip05.isNip05(value)){
        return nip05.isValid(pubkey, value)
    }
    return false;
}

self.onmessage = ({ data }) => {
    let { nip05 } = data;
    const { pubkey } = data;
    
    if(!nip05.includes('@')){
        nip05 = `_@${nip05}`
    }
    
    const valid = check(pubkey, nip05)
    if(valid instanceof Promise) {
        return valid.then( (valid: boolean) => self.postMessage({pubkey, nip05, valid}) )
    }
    self.postMessage({pubkey, nip05, valid})
}