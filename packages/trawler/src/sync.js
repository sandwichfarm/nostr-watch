import { SyncQueue } from "@nostrwatch/controlflow"
import hash from 'object-hash'
import config from "./config.js"

const { $Queue:$SyncQueue } = SyncQueue()

export const syncRelayOut = async (data) => {
  if(config?.trawler?.sync?.relays?.out?.queue){
    if(data.payload instanceof Array) throw new Error("syncRelayOut(): data.payload must be an object, not an array, otherwise use syncRelaysOut() if trying to sync multiple relays")
    await $SyncQueue.add('relay-create', data, { priority: 1 /*, jobId: `SyncOut@${process.env.DAEMON_PUBKEY}:${data.url}` */ })
  }
}

export const syncRelaysOut = async (data) => {
  if(config?.trawler?.sync?.relays?.out?.queue){
    if(!(data.payload instanceof Array)) throw new Error("syncRelaysOut(): data.payload must be an array, not an object, otherwise use syncRelayOut() if trying to sync a single relay")
    await $SyncQueue.add('relays-create', data, { priority: 1 /*, jobId: `SyncOut@${process.env.DAEMON_PUBKEY}:${hash(data.payload)}` */ })
  }
}

export const syncRelayIn = async (data) => {
  if(config?.trawler?.sync?.relays?.in?.queue){
    if(data.payload instanceof Array) throw new Error("syncRelayIn(): data.payload must be an object, not an array, otherwise use syncRelaysIn() if trying to sync multiple relays")
    await $SyncQueue.add('relay-get', data, { priority: 1, jobId: `SyncIn@${process.env.DAEMON_PUBKEY}:${data.url}` })
    //watch for completed on jobid, populate cache
  }
  if(config?.trawler?.sync?.relays?.in?.events){
    //subscribe to events matching kind/pubkey/tag[d] filter, populate cache
  }
}

export const syncRelaysIn = async (data) => {
  if(config?.trawler?.sync.relays?.in?.queue){
    if(!(data.payload instanceof Array)) throw new Error("syncRelaysIn(): data.payload must be an array, not an object, otherwise use syncRelayIn() if trying to sync a single relay")
    await $SyncQueue.add('relays-get', data, { priority: 1, jobId: `SyncIn@${process.env.DAEMON_PUBKEY}:${hash(data.payload)}` })
    //watch for completed on jobid, populate cache
  }
  if(config?.trawler?.sync?.relays?.in?.events){
    //subscribe to events matching kind/pubkey filter, populate cache
  }
}

export default {
  relay: {
    out: syncRelayOut,
    in: syncRelayIn
  },
  relays: {
    out: syncRelaysOut,
    in: syncRelaysIn
  }
}