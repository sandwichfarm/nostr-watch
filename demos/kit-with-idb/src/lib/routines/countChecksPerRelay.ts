import { checkStatStore } from "$lib/stores"
import { relayDb } from "@nostrwatch/idb"

export const countChecksPerRelay = async () => { 
  const relays = await relayDb.relays.toArray()
  relays.forEach( async (record) => {
    const { relay } = record
    const checks = await relayDb.checks.where({ relay }).toArray()
    const pubkeys = checks.map(check => check.monitorPubkey)
    checkStatStore.update(store => store.set(relay, pubkeys))
  })
}