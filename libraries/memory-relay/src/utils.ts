import { EventKeyDataType, EventType } from "./types.js";
import { Filter, NostrEvent } from "nostr-tools";
import { IEvent } from "@nostrwatch/route66/models/Event";

const isReplaceableKind = (kind: number): boolean =>
    kind === 0 || kind === 3 || (kind >= 10000 && kind < 20000);

const isParameterizedReplaceableKind = (kind: number): boolean =>
    kind >= 30000 && kind < 40000;

export const eventType = ( event: any ): EventType => {
    if(isReplaceableKind(event.kind)) {
        return 'replaceable';
    }
    else if(isParameterizedReplaceableKind(event.kind)){
        return 'parameterized';
    }
    else {
        return 'event'
    }
}

export const eventAddr = ( event: any, type?: EventType ) => {
    let { pubkey, kind } = event;
    type = type ?? eventType(event);
    pubkey = pubkey.slice(0,16);
    if(type === 'parameterized') {
        const dtag = event.tags.find((t: string[]) => t[0] === 'd')?.[1]
        const key = `${pubkey}:${kind}:${dtag}`;
        return key;
    }
    else if(type === 'replaceable') {
        const key = `${pubkey}:${kind}`
        return key;
    }
}

export const eventKey = (event: any, type?: EventType) =>{
    type = type ?? eventType(event);
    if(type === 'replaceable') {
        return eventAddr(event, type);
    }
    else if(type === 'parameterized') {
        return eventAddr(event, type);
    }
    else {
        return event.id
    }
}

export const eventIdData = (event: any): EventKeyDataType => {
    const type =  eventType(event)
    return {
        type,
        key: eventKey(event, type)
    }
}

export function eventMatchesFilter(ev: IEvent | NostrEvent | any, filter: Filter): boolean {
    if (filter.since && ev.created_at < filter.since) {
      return false;
    }
    if (filter.until && ev.created_at > filter.until) {
      return false;
    }
    if (!(filter.ids?.includes(ev.id) ?? true)) {
      return false;
    }
    if (!(filter.authors?.includes(ev.pubkey) ?? true)) {
      return false;
    }
    if (!(filter.kinds?.includes(ev.kind) ?? true)) {
      return false;
    }
    const orTags = Object.entries(filter).filter(([k]) => k.startsWith("#"));
    for (const [k, v] of orTags) {
      const vargs = v as Array<string>;
      for (const x of vargs) {
        if (!ev.tags.find((a: string[]) => a[0] === k.slice(1) && a[1] === x)) {
          return false;
        }
      }
    }
    const andTags = Object.entries(filter).filter(([k]) => k.startsWith("&"));
    for (const [k, v] of andTags) {
      const vargs = v as Array<string>;
      const allMatch = vargs.every(x => ev.tags.some((tag: string[]) => tag[0] === k.slice(1) && tag[1] === x));
      if (!allMatch) {
        return false;
      }
    }
    return true;
  }
