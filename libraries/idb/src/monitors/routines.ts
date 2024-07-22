import monitorDb from "./db";
import { eventsPurgeMonitors } from "src/relays/routines";

export const monitorsPurgeLastSeen = (thresholdMillis: number = 3600000) => {
    const threshold = thresholdMillis / 1000;
    const now = Date.now() / 1000;
    const cutoff = now - threshold;
    const monitors = monitorDb.monitors;
    const count = monitors.count();
    console.log("Purging monitors last seen before", cutoff, "(", count, "monitors)");
    monitors.where("lastSeen").below(cutoff).delete();
}

export const monitorsPurgePubkey = async (monitorPubkeys: string | string[]) => {
  const monitors = monitorDb.monitors;
  if(!monitors) return
  if(typeof monitorPubkeys === "string") {
      monitorPubkeys = [monitorPubkeys];
  }
  const count = monitors.count();
  console.log("Purging monitors for monitors", monitorPubkeys, "(", count, "monitors)");
  await monitors.where("monitorPubkey").anyOf(monitorPubkeys).delete();
  await eventsPurgeMonitors(monitorPubkeys)
}


export const monitorsPurgeAll = () => {
  const monitors = monitorDb.monitors;
  if(!monitors) return
  const count = monitors.count();
  console.log("Purging all monitors", "(", count, "monitors)");
  monitors.clear();
}