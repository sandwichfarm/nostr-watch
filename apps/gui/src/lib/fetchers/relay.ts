import { nip11Service } from "$stores/nip11s"
import { get } from "svelte/store"
import { fetchOperators } from "./bootstrap"
import { isPubkey } from "$utils/nostr"
import { relayNip11, relayNip11$, relayNip11s$ } from "$stores/helpers/helpers-nip11s"
import { relayLivenessChecks$ } from "$stores/helpers/helpers-relay"
import { delay } from "@nostrwatch/utils"
import type { IEvent } from "@nostrwatch/route66/models"
import type { Nip11 } from "@nostrwatch/route66/models"
import { operatorRelays } from "$stores/helpers/helpers-operator"
import { instance } from "$utils/lifecycle"

export const fetchRelayChecks = async (relay: string) => {
    const $route66 = await instance()
    await $route66.ready();
    $route66?.services?.relay?.getRelayData(relay, 'online')
}

export const fetchRelayNip11 = async (relay: string): Promise<Nip11 | undefined> => {
    return get(nip11Service).check(relay)
}

export const fetchRelayOperator = async (relay: string): Promise<IEvent[]> => {
    const nip11sReadable = relayNip11s$(relay)
    const checksReadable = relayLivenessChecks$(relay)
    const $nip11s = get(nip11sReadable)
    const $checks = get(checksReadable)
    while($nip11s === undefined || $checks === undefined) {
        await delay(100)
    }
    const operatorPubkey = $nip11s[0]?.pubkey ?? $checks.find(check => check.operatorPubkey)?.pubkey
    if(!operatorPubkey) return
    return fetchOperators([operatorPubkey])
}



export const fetchOperatorRelays = async (pubkey: string) => {
    return operatorRelays(pubkey)
}