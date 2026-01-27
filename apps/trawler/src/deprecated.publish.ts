/// <reference lib="deno.ns" />

import Publish from '@nostrwatch/publisher';
import { db } from "@nostrwatch/db";
import config from "./config.js";
import { lastPublishedId } from "./utils.js";

interface Relay {
  url: string;
  [key: string]: any;
}

const p30166 = new Publish.Kind30166();

const filterRelayProperties = (relay: Relay): Relay => {
  const relay_: Relay = {};
  const relayProps = config?.trawler?.sync?.relays?.out?.events?.properties;
  if (!(relayProps instanceof Array)) return relay;
  Object.entries(relay).forEach(entry => {
    if (relayProps.includes(entry[0])) {
      relay_[entry[0]] = entry[1];
    }
  });
  return relay_;
};

const filterRelaysProperties = (relays: Relay[]): Relay[] => {
  return relays.map(filterRelayProperties);
};

const updatePublishTimes = async (relays: Relay[] = []): Promise<void> => {
  for await (const relay of relays) {
    const timestamp = Math.round(Date.now() / 1000);
    db.query(
      `INSERT INTO seeder_timestamps (method, timestamp)
       VALUES (?, ?)
       ON CONFLICT(method) DO UPDATE SET
         timestamp = excluded.timestamp`,
      [lastPublishedId(relay.url), timestamp]
    );
  }
};

export const publishOne = async (relay: Relay): Promise<void> => {
  const filteredRelay = filterRelayProperties(relay);
  if (!filteredRelay) throw new Error('publishOne(): relay must be defined');
  await p30166.one(filteredRelay);
};

export const publishMany = async (relays: Relay[] = []): Promise<void> => {
  const filteredRelays = filterRelaysProperties(relays);
  if (!filteredRelays.length) return;
  await p30166.many(filteredRelays);
  await updatePublishTimes(relays);
};

export const publishAll = async (): Promise<void> => {
  const relays: Relay[] = [];
  for (const [url, online, ignore, parent, checked_at, rtt, network] of db.query("SELECT url, online, ignore, parent, checked_at, rtt, network FROM relay_status")) {
    relays.push({
      url: url as string,
      online: online as number === 1,
      ignore: ignore as number === 1,
      parent: parent as string,
      checked_at: checked_at as number,
      rtt: rtt as number,
      network: network as string
    });
  }
  await publishMany(relays);
};

export default {
  many: publishMany,
  one: publishOne,
  all: publishAll
}; 