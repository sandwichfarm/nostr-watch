import { isParameterizedReplaceableKind, isReplaceableKind, Metadata } from 'nostr-tools/kinds';

export const formatPubkeyForIndex = (pubkey: string) => {
    // if(!pubkey || typeof pubkey !== 'string') {
    //     console.log('formatPubkeyForIndex', pubkey)
    //     return undefined;
    // }
    return pubkey!.slice(0,16);
}
export const eventAddr = ( event: any ) => {
    let { pubkey, kind } = event;
    if(!pubkey) {
        console.log('eventAddr', event)
        return undefined;
    }
    pubkey = formatPubkeyForIndex(pubkey);
    if(isParameterizedReplaceableKind(kind)) {
        const relay = event.tags.find(t => t[0] === 'd')?.[1]
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
    else if(isParameterizedReplaceableKind(event.kind)){
        return eventAddr(event);
    }
    else {
        return event.id
    }
}