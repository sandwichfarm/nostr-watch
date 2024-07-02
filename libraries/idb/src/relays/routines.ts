import relayDb from "./db";
// import type { RelayDb } from "./db";

const events = relayDb.events;

export const eventsPurgeAge = async (thresholdMillis: number = 1000*60*60*24) => {
    const threshold = thresholdMillis / 1000;
    const now = Date.now() / 1000;
    const cutoff = now - threshold;
    const count = await events.count();
    console.log("Purging events older than", cutoff, "(", count, "events)");
    events.where("createdAt").below(cutoff).delete();
}

export const eventsPurgeCount = async (maximumEvents: number = 1000) => {
    if(!events) return
    const count = await events.count();
    if(count > maximumEvents) {
      const eventsToPurge = events.orderBy("createdAt").reverse().offset(maximumEvents);      
      const cutoff = count - maximumEvents;
      console.log("Purging events older than", cutoff, "(", count, "events)");
      await eventsToPurge.delete();
    }
}

export const eventsPurgeMonitors = async (monitorPubkeys: string | string[]) => {
  if(!events) return
  if(typeof monitorPubkeys === "string") {
      monitorPubkeys = [monitorPubkeys];
  }
  const eventsToPurge = events.where("monitorPubkey").anyOf(monitorPubkeys)
  const count = events.count();
  console.log("Purging events for monitors", monitorPubkeys, "(", count, "events)");
  await eventsToPurge.delete();
}

export const eventsPurgeRelays = async (relays: string | string[]) => {
  if(!events) return
  if(typeof relays === "string") {
      relays = [relays];
  }
  const eventsToPurge = events.where("relay").anyOf(relays)
  const count = await eventsToPurge.count();
  console.log("Purging events for relays", relays, "(", count, "events)");
  eventsToPurge.delete();
}

export const eventsPurgeAll = async () => {
  if(!events) return
  const count = await events.count();
  console.log("Purging all events", "(", count, "events)");
  await events.clear();
}