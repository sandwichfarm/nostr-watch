import { derived, get, readable, type Readable } from "svelte/store";
import { eventsChecks, relayCheckAggregates, relayChecks } from "../checks";
import { pubkeyProfile, pubkeyProfile$, pubkeyRelays, pubkeyRelays$, pubkeyUserInstance, pubkeyUserInstance$, type StorePubkeyProfile, type StorePubkeyProfileReadable, type StorePubkeyRelays, type StorePubkeyRelaysReadable, type StoreUser, type StoreUserReadable } from "./helpers-pubkey";
import type { Nip66CheckEvent } from "@nostrwatch/route66/models/Nip66CheckEvent";
import { events, eventsArray, type StoreEventType } from "$stores/events";
import type { NostrEvent } from "nostr-tools";
import { relayNip11$ } from "./helpers-nip11s";
import { relayLivenessObjectFactory, relaysLiveness, type RelayLivenessObject } from "$stores/relays";
import type { IGeocode } from "@nostrwatch/route66/models/Geocode";
import { ipRelayMap } from "$stores/ips";
import { relaysByGeo } from "$stores/geocodes";

type AggregateType = Record<string, {
    a: Record<string, any>;
    checks: any[];
    aggregate?: any;
}>

export const relayLivnessDetermination = (relayUrl: string): RelayLivenessObject => {
    return get(relaysLiveness).get(relayUrl) || relayLivenessObjectFactory(relayUrl);
}

export const relayLivenessDetermination$ = (relayUrl: string): Readable<RelayLivenessObject >=> {
    return derived(relaysLiveness, ($relaysLiveness) => {
        return $relaysLiveness.get(relayUrl) || relayLivenessObjectFactory(relayUrl);
    })
}

export const relayLivenessAggregate = (relayUrl: string): any | undefined => {
    return get(relayChecks)?.[relayUrl]?.aggregate;
}

export const relayLivenessAggregate$ = (relayUrl: string): Readable<any | undefined> => {
    return derived(relayChecks, ($relayChecks) => {
        return $relayChecks?.[relayUrl]?.aggregate;
    })
}

export const relayLivenessChecks = (relayUrl: string): Nip66CheckEvent[] => {
    return get(eventsChecks)?.filter(event => (event as Nip66CheckEvent).relay === relayUrl) as Nip66CheckEvent[]; 
}

export const relayLivenessChecks$ = (relayUrl: string): Readable<Nip66CheckEvent[]> => {
    return derived(eventsArray, ($relayChecks: StoreEventType[]) => {
        return $relayChecks.filter(event => (event as Nip66CheckEvent).relay === relayUrl) as Nip66CheckEvent[];  
    })
}

export const relayOperatorPubkey = (relay: string): string | undefined => {
    const record = get(relayChecks)?.[relay];
    return record?.aggregate?.operatorPubkey;
}

export const relayOperatorPubkey$ = (relay: string): Readable<string | undefined> => {
    return derived([relayChecks, relayNip11$(relay)], ([$relayChecks, $nip11]) => {
        if($nip11?.pubkey) return $nip11.pubkey;
        const record = $relayChecks?.[relay];
        return record?.aggregate?.operatorPubkey;
    });
}

export const relayOperatorUser = (relay: string): StoreUser => {
    const pubkey = relayOperatorPubkey(relay)
    if(!pubkey) return;
    return pubkeyUserInstance(pubkey);
}

export const relayOperatorUser$ = (relay: string): Readable<StoreUser> => {
    const pubkey = relayOperatorPubkey(relay)
    if(!pubkey) return readable(undefined);
    return pubkeyUserInstance$(pubkey);
}

export const relayOperatorRelayList = (relay: string) => {
    const pubkey = relayOperatorPubkey(relay)
    if(!pubkey) return;
    return pubkeyRelays(pubkey);
}

export const relayOperatorRelayList$ = (relay: string): Readable<StorePubkeyRelays> => {
    const pubkey = relayOperatorPubkey(relay)
    if(!pubkey) return readable(undefined);
    return pubkeyRelays$(pubkey);
}

export const relayOperatorProfile = (relay: string): StorePubkeyProfile => {
    const pubkey = relayOperatorPubkey(relay)
    if(!pubkey) return;
    return pubkeyProfile(pubkey);
}

export const relayOperatorProfile$ = (relay: string): Readable<StorePubkeyProfile> => {
    const pubkey = relayOperatorPubkey(relay)
    if(!pubkey) return readable(undefined);
    return pubkeyProfile$(pubkey);
}

export const relayCountryCodes = (relay: string): IGeocode[] => {
    return relayLivenessChecks(relay).map(  (event) => event?.geocodes ).flat().filter(Boolean);
}

export const relayCountryCodes$ = (relay: string): Readable<IGeocode[]> => {
    return derived(relayLivenessChecks$(relay), ($checks) => {
        return $checks.map( (event) => event?.geocodes ).flat().filter(Boolean);
    })
}

export const relayIps= (relay: string): { ipv4: string[], ipv6: string[] } => {
    const ipv4 = relayLivenessAggregate(relay)?.ipv4;
    const ipv6 = relayLivenessAggregate(relay)?.ipv6;
    return { ipv4, ipv6 };
}

export const relayIps$ = (relay: string): Readable<{ ipv4: string[], ipv6: string[] }> => {
    return derived(relayLivenessAggregate$(relay), ($aggregate) => {
        const ipv4 = $aggregate?.ipv4 || [];
        const ipv6 = $aggregate?.ipv6 || [];
        return { ipv4, ipv6 };
    })
}

export const relayCountryGeohashes = (relay: string): string[] => {
    return relayLivenessChecks(relay).map(  (event) => event?.geohash ).filter( e => e !== null && e !== undefined );
}

export const relayCountryGeohashes$ = (relay: string): Readable<string[]> => {
    return derived(relayLivenessChecks$(relay), ($checks) => {
        return $checks.map(  (event) => event?.geohash ).filter( e => e !== null && e !== undefined );
    })
}

export const relayLastSeen = (relay: string): Date | undefined => {
    return relayLivenessAggregate(relay)?.lastSeen;
}

export const relayLastSeen$ = (relay: string): Readable<Date | undefined> => {
    return derived(relayLivenessAggregate$(relay), ($aggregate) => {
        return $aggregate?.lastSeen;
    })
}

export const relaySeenTimes = (relay: string): number => {
    return relayLivenessChecks(relay).length;
}

export const relaySeenTimes$ = (relay: string): Readable<number> => {
    return derived(relayLivenessChecks$(relay), ($checks) => {
        return $checks.length;
    })
}

export const relaySeenBy = (relay: string): string | undefined => {
    return relayLivenessAggregate(relay)?.seenBy;
}

export const relaySeenBy$ = (relay: string): Readable<string | undefined> => {
    return derived(relayLivenessAggregate$(relay), ($aggregate) => {
        return $aggregate?.seenBy;
    })
}

export const relaySimilarByIpv4 = (relay: string): string[] => {
    const { ipv4 } = relayIps(relay);
    const relaysSimilar: string[] = []
    ipv4.forEach( _ipv4 => {
        const values = get(ipRelayMap)?.get(_ipv4)
        if(!values) return;
        values.forEach( value => relaysSimilar.push(value));
    });
    return relaysSimilar;
}

export const relaySimilarByIpv6 = (relay: string): string[] => {
    const { ipv6 } = relayIps(relay);
    const relaysSimilar: string[] = []
    ipv6.forEach( _ipv6 => {
        const values = get(ipRelayMap)?.get(_ipv6)
        if(!values) return;
        values.forEach( value => relaysSimilar.push(value));
    });
    return relaysSimilar;
}

export const relaySimilarRelaysByIp = (relay: string): string[] => {
    const { ipv4, ipv6 } = relayIps(relay);
    const ipv4RelaysSimilar = relaySimilarByIpv4(relay);
    const ipv6RelaysSimilar = relaySimilarByIpv6(relay);
    return Array.from(new Set([...ipv4RelaysSimilar, ...ipv6RelaysSimilar]));
}


export const relaysSimilarCountry = (relay: string): string[] => {
    const countryCodes = Array.from( new Set(relayCountryCodes(relay)
        .filter( code => code.format === 'alpha' && code.length === 2 )
        .map( code => code.code )));
    const similar: Set<string> = new Set()
    for(const code of countryCodes){
        get(relaysByGeo)?.get(code)?.forEach( relay => similar.add(relay));
    }
    return Array.from(similar);
}

export const relaysSimilarIsp = (relay: string): string[] => {
   
}

export const relaySimilarRelaysByGeohash = (relay: string): string[] => {
    const geohashes = relayCountryGeohashes(relay);
    const relaysSimilar: string[] = []
    geohashes.forEach( geohash => {
        const values = get(ipRelayMap)?.get(geohash)
        if(!values) return;
        values.forEach( value => relaysSimilar.push(value));
    });
    return relaysSimilar;
}

export const relaySimilarRelays = (relay: string): string[] => {
    const similarByIp = relaySimilarRelaysByIp(relay);
    const similarByCountry = relaysSimilarCountry(relay);
    const similarByIsp = relaysSimilarIsp(relay);
    const similarByGeohash = relaySimilarRelaysByGeohash(relay);
    return Array.from(new Set([...similarByIp, ...similarByCountry, ...similarByIsp, ...similarByGeohash]));
}

export const relayIsp = (relay: string): string | undefined => {
    return relayLivenessAggregate(relay)?.isp;
}

export const relayIsp$ = (relay: string): Readable<string | undefined> => {
    return derived(relayLivenessAggregate$(relay), ($aggregate) => {
        return $aggregate?.isp;
    })
}