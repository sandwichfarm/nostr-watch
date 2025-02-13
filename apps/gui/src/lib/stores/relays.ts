import { derived, get, readable, writable, type Readable, type Writable } from 'svelte/store';
import { eventsArray } from './events.js';
import { StateManager } from '@nostrwatch/route66';
import { relayCheckAggregates, relayChecks } from './checks.js';
import { doAggregateCache } from './app.js';
import type { Nip66CheckEvent } from '@nostrwatch/route66/models/Nip66CheckEvent';
import type { IResult } from '@nostrwatch/nocap';

export const relays: Readable<string[]> = derived(relayCheckAggregates, ($relayCheckAggregates) => {
    const relays: Set<string> = new Set();

    $relayCheckAggregates.forEach((relayAggregate) => {
        const { relay} = relayAggregate
        if (!relay) return console.warn('derived relays: no relay', relayAggregate);
        try {
            const normalized = new URL(relay).toString()
            if(relays.has(normalized)){
                // const matches = $relayCheckAggregates.filter( aggregate => aggregate.relay === normalized || aggregate.relay === relay)
                // console.warn('derived relays: duplicate', matches?.length, matches);    
                return;
            }
            relays.add(normalized);
        }
        catch(e){
            console.warn('derived relays: error', e)
        }
    });

    let relaysArr = Array.from(relays);

    if(relaysArr.length){
        if(get(doAggregateCache)) StateManager.set('aggregate:relays', relaysArr);
    }
    else {
        relaysArr = StateManager.get('aggregate:relays')
    } 

    return relaysArr;
});

export enum RelayLivenessType {
    Online = 'online',
    MaybeOffline = 'maybe offline',
    Offline = 'offline',
    Dead = 'dead',
    Unknown = 'unknown'
}

export type RelayLivenessObject = {
    relay: string;
    remoteChecks: Nip66CheckEvent[];
    localCheck: Partial<IResult>;
    determination: RelayLivenessType;
}

export const relayLivenessObjectFactory = (relay: string): RelayLivenessObject => {
    return {
        relay,
        remoteChecks: [],
        localCheck: { open: { data: false, duration: -1 } },
        determination: RelayLivenessType.Unknown
    }
}

export const localRelayChecks: Writable<Map<string, IResult>> = writable(new Map());

export const relaysLiveness: Readable<Map<string, RelayLivenessObject>> = derived(
    [localRelayChecks, relayChecks],
    ([$localRelayChecks, $relayChecks]) => {
        const relaysLiveness = new Map();
        for( const [relay, check] of Object.entries($relayChecks)){
            const { checks:remoteChecks } = check
            const localCheck = $localRelayChecks.get(relay);
            const remoteDetermination: RelayLivenessType = remoteChecks.length > 0? RelayLivenessType.Online: RelayLivenessType.Offline;
            let localDetermination: RelayLivenessType | undefined = undefined;
            let determination: RelayLivenessType | undefined = undefined;
            if(typeof localCheck !== 'undefined') {
                localDetermination = localCheck?.open?.data === true? RelayLivenessType.Online : RelayLivenessType.Offline;
            }
            if(
                (localDetermination === RelayLivenessType.Online && remoteDetermination === RelayLivenessType.Online)
                || (localDetermination === RelayLivenessType.Online && remoteDetermination === RelayLivenessType.Offline)
                || (typeof localDetermination === 'undefined' && remoteDetermination === RelayLivenessType.Online)
            ){
                determination = RelayLivenessType.Online;
            }
            else if(localDetermination === RelayLivenessType.Offline && remoteDetermination === RelayLivenessType.Online){
                determination = RelayLivenessType.MaybeOffline;
            }
            else {
                determination = RelayLivenessType.Offline;
            }
            relaysLiveness.set(relay, { relay, remoteChecks, localCheck, determination });
        };
        return relaysLiveness;
    }
);