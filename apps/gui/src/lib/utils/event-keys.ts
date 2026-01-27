import type { NostrTag } from '@nostrwatch/route66/models/Event';
import { isAddressableKind, isReplaceableKind, Metadata } from 'nostr-tools/kinds';

export const formatPubkeyForIndex = (pubkey: string) => pubkey!.slice(0,16);

export const eventAddr = ( event: any ) => {
    let { pubkey, kind } = event;
    if(!pubkey || typeof pubkey !== 'string') return '';
    pubkey = formatPubkeyForIndex(pubkey);
    if(isAddressableKind(kind)) {
        const relay = event.tags.find((t: NostrTag) => t[0] === 'd')?.[1]
        const key = `${pubkey}:${kind}:${relay}`
        return `${pubkey}:${kind}:${relay}`;
    }
    else if(isReplaceableKind(kind)) {
        const key = `${pubkey}:${kind}`
        return `${pubkey}:${kind}`;
    }
}

export const eventKey = (event: any) =>{
    if(isReplaceableKind(event.kind)) {
        return eventAddr(event);
    }
    else if(isAddressableKind(event.kind)){
        return eventAddr(event);
    }
    else {
        return event.id
    }
}