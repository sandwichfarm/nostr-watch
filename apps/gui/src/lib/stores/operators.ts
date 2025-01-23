import { derived, get, writable, type Readable, type Writable } from "svelte/store";
import type { User } from "../models/User";
import { relayCheckAggregates } from "./checks";
import {  pubkeyUserInstance } from "./helpers/helpers-pubkey";
import { operatorIsps, operatorRelays, operatorRelaysOperated, operatorSoftwares } from "./helpers/helpers-operator";
import { type StoreIsp, isps } from "./isps";

export const operatorsPubkeys: Readable<string[]> = derived(
    relayCheckAggregates,
    ($relayCheckAggregates) => {
        const operators = new Set<string>();
        $relayCheckAggregates.forEach((relayCheck) => {
            const { operatorPubkey } = relayCheck;
            if (operatorPubkey) {
                operators.add(operatorPubkey);
            }
        });
        return Array.from(operators).sort()
    }
)

export const operatorsUserInstances: Readable<Map<string, User>> = derived(
    operatorsPubkeys,
    ($operatorsPubkeys) => {
        const operatorsEvents = new Map();
        if($operatorsPubkeys.length > 0) {
            $operatorsPubkeys.forEach((operator) => {
                const userInstance = pubkeyUserInstance(operator);
                //console.log('userinstance', operator, userInstance)
                operatorsEvents.set(operator, userInstance);
            });
        }
        return operatorsEvents;
    }
)


export type OperatorsRow = Record<keyof User | 'id' | 'isps' | 'ispsCount' | 'relays' | 'relaysCount' | 'softwares' | 'softwaresCount', string | number | boolean | any[] | undefined>

export const operatorsRows: Readable<OperatorsRow[]> = derived(
    [operatorsUserInstances],
    ([$operatorsUserInstances]) => {
        const rows: any[] = []
        $operatorsUserInstances.forEach((userInstance) => {
            if(!userInstance) return;
            //console.log('userInstance', userInstance)       
            const keys = userInstance.keys;
            const row: OperatorsRow = Object.fromEntries( 
                keys
                    .map( (key: keyof User) => [ key, userInstance[key]] ) 
                    .filter( (entry) => typeof entry[1] !==  'function' )
            )
            row.id = userInstance.pubkey;
            row.isps = operatorIsps(userInstance.pubkey);
            row.ispsCount = row.isps?.length || 0;
            row.relays = operatorRelaysOperated(userInstance.pubkey);
            row.relaysCount = row.relays?.length || 0;
            row.softwares = operatorSoftwares(userInstance.pubkey);
            row.softwaresCount = row.softwares?.length || 0;
            rows.push(row);
        });
        return rows;
    }
)

