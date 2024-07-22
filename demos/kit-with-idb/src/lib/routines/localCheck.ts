import { queueStore } from "$lib/stores/QueueStore";
import { relayDb, type ICheck } from "@nostrwatch/idb";
import { relayStore } from "$lib/stores/relayStore";

export let localPing = new Map()

export const initLocalCheck = async () => {
  const relays = await relayDb.relays.toArray();

  relays.forEach( async (relay) => {
    
    const { relay: url } = relay;
    console.log('add task', relay)
    const { result } = await queueStore.addTask(url);
    console.log('finish task', result)

    localPing.set(url, result);
    
    const record: ICheck = {
      nid: 'na',
      monitorPubkey: 'currentuser',
      relay: url,
      open: result,
      createdAt: Math.round(new Date().getTime()/1000)
    }
    await relayDb.checks.put(record);
    console.log('user check', (await relayDb.checks.where({relay: url, monitorPubkey: 'currentuser' }).first())?.open)
  })
}