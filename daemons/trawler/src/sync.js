
import hash from 'object-hash'

import { SyncQueue } from "@nostrwatch/controlflow"

import config from "./config.js"
import publish from "./publish.js"

const { $Queue:$SyncQueue } = SyncQueue()

const syncConfig = config?.trawler?.sync

export const syncRelayOut = async (data) => {
  if(data.payload instanceof Array) throw new Error("syncRelayOut(): data.payload must be an object, not an array, otherwise use syncRelaysOut() if trying to sync multiple relays")
  if(syncConfig?.relays?.out?.queue){
    await $SyncQueue.add('relay-create', data, { priority: 1 /*, jobId: `SyncOut@${process.env.DAEMON_PUBKEY}:${data.url}` */ })
  }
  if(syncConfig?.relays?.out?.events){
    await publish.one( data.payload  )
  }
}

export const syncRelaysOut = async (data) => {
  if(!(data.payload instanceof Array)) throw new Error("syncRelaysOut(): data.payload must be an array of objects, not an object, otherwise use syncRelayOut() if trying to sync a single relay")
  if(syncConfig?.relays?.out?.queue){
    await $SyncQueue.add('relays-create', data, { priority: 1 /*, jobId: `SyncOut@${process.env.DAEMON_PUBKEY}:${hash(data.payload)}` */ })
  }
  if(syncConfig?.relays?.out?.events){
    await publish.many( data.payload )
  }
}

export const syncRelayIn = async (data) => {
  if(syncConfig?.relays?.in?.queue){
    if(data.payload instanceof Array) throw new Error("syncRelayIn(): data.payload must be an object, not an array, otherwise use syncRelaysIn() if trying to sync multiple relays")
    await $SyncQueue.add('relay-get', data, { priority: 1, jobId: `SyncIn@${process.env.DAEMON_PUBKEY}:${data.url}` })
    //watch for completed on jobid, populate cache
  }
  if(syncConfig?.relays?.in?.events){
    //subscribe to events matching kind/pubkey/tag[d] filter, populate cache
  }
}

export const syncRelaysIn = async (data) => {
  if(syncConfig?.relays?.in?.queue){
    if(!(data.payload instanceof Array)) throw new Error("syncRelaysIn(): data.payload must be an array, not an object, otherwise use syncRelayIn() if trying to sync a single relay")
    await $SyncQueue.add('relays-get', data, { priority: 1, jobId: `SyncIn@${process.env.DAEMON_PUBKEY}:${hash(data.payload)}` })
    //watch for completed on jobid, populate cache
  }
  if(syncConfig?.relays?.in?.events){
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