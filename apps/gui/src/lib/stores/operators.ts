import { derived, get, writable, type Readable, type Writable } from "svelte/store";
import type { User } from "../models/User";
import { relayCheckAggregates } from "./checks";
import {  pubkeyUserInstance } from "./helpers/helpers-pubkey";
import { operatorIsps, operatorRelays, operatorRelaysOperated, operatorSoftwares } from "./helpers/helpers-operator";
import { isHex, isPubkey } from "$utils/nostr";
import { StateManager } from "@nostrwatch/route66";

export const operatorsPubkeys: Readable<string[]> = derived(
    relayCheckAggregates,
    ($relayCheckAggregates) => {
        const operators = new Set<string>();
        $relayCheckAggregates.forEach((relayCheck) => {
            const { operatorPubkey, liveness } = relayCheck;
            // Only include operators who have at least one online relay
            if (operatorPubkey && liveness === 'online') {
                operators.add(operatorPubkey);
            }
        });
        return Array.from(operators).sort()
    }
)

export const operatorsPubkeysValid: Readable<string[]> = derived(
    operatorsPubkeys,
    ($operatorsPubkeys) => {
        return $operatorsPubkeys.filter(isPubkey)
    }
)

export const operatorsUserInstances: Readable<Map<string, User>> = derived(
    operatorsPubkeys,
    ($operatorsPubkeys) => {
        const operatorsEvents = new Map();
        if($operatorsPubkeys.length > 0) {
            $operatorsPubkeys.forEach((operator) => {
                if(typeof operator !== 'string' || !isHex(operator)) {
                    console.debug('Invalid pubkey:', operator)
                    return;
                }
                const userInstance = pubkeyUserInstance(operator);
                operatorsEvents.set(operator, userInstance);
            });
        }
        return operatorsEvents;
    }
)


export type OperatorsRow = Record<keyof User | 'id' | 'isps' | 'ispsCount' | 'relays' | 'relaysCount' | 'softwares' | 'softwaresCount', string | number | boolean | any[] | undefined | null >

export const operatorsRows: Readable<OperatorsRow[]> = derived(
    [operatorsUserInstances],
    ([$operatorsUserInstances]) => {
        const fromCacheValues: OperatorsRow[] = StateManager.get('aggregate:operators');
        const cachedByPubkey = new Map<string, OperatorsRow>();
        if (Array.isArray(fromCacheValues)) {
            for (const row of fromCacheValues) {
                const pubkey = (row as any)?.pubkey;
                if (typeof pubkey === 'string') cachedByPubkey.set(pubkey, row);
            }
        }

        let rows: OperatorsRow[] = [];
        let hasAnyMetadata = false;

        if ($operatorsUserInstances.size > 0) {
            $operatorsUserInstances.forEach((userInstance, pubkey) => {
                if (userInstance) hasAnyMetadata = true;
                const row: OperatorsRow = userInstance
                    ? (Object.fromEntries(
                          userInstance.keys
                              .map((key: keyof User) => [key, userInstance[key]])
                              .filter((entry) => typeof entry[1] !== 'function')
                      ) as OperatorsRow)
                    : ((cachedByPubkey.get(pubkey) ?? { pubkey, name: pubkey }) as unknown as OperatorsRow);

                row.id = pubkey;
                row.pubkey = pubkey;
                row.isps = operatorIsps(pubkey);
                row.ispsCount = row.isps?.length || 0;
                row.relays = operatorRelaysOperated(pubkey);
                row.relaysCount = row.relays?.length || 0;
                row.softwares = operatorSoftwares(pubkey);
                row.softwaresCount = row.softwares?.length || 0;
                rows.push(row);
            });

            if (rows.length && hasAnyMetadata) StateManager.set('aggregate:operators', rows);
            if (rows.length) return rows;
        }

        return fromCacheValues?.length ? fromCacheValues : [];
    }
)
