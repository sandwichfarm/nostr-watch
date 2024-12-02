import { nip05 } from "nostr-tools";
import type { Nip05 } from "nostr-tools/nip05";

const check = (pubkey: string, value: Nip05) => {
    if(nip05.isNip05(value)){
        return nip05.isValid(pubkey, value)
    }
    return false;
}

self.onmessage = ({ data }) => {
    const { pubkey, nip05 } = data;
    const result = check(pubkey, nip05);
    self.postMessage({pubkey, nip05, result}); 
}