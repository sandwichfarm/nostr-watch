// src/index.ts
import fs from 'fs/promises';
import yaml from 'js-yaml';

import { extractConfig } from '@nostrwatch/utils';
import Logger from '@nostrwatch/logger';
import { fetch } from 'cross-fetch';
import configPromise from './config';

let cache: any;

const DEFAULT_RELAYS = [
  'wss://relay.nostr.watch',
  'wss://history.nostr.watch',
  'wss://relaypag.es',
];



const logger = new Logger('@nostrwatch/seed');

export const bootstrap = async (
  caller: string
): Promise<[string[], Record<string, number>]> => {

  const config = await configPromise;
  
  const opts = await extractConfig(caller, 'seed');

  if (Object.keys(opts).length === 0) {
    logger.warn(`Skipping seed because there is no seed config`);
    return [[], {}];
  }

  if (!opts?.sources) {
    logger.warn(
      `No seed sources specified in 'config.${caller}.seed.sources' nor in 'config.seed.sources', cannot seed`
    );
    return [[], {}];
  }

  let configseed: [string[], number] = emptyResponse(),
    staticseed: [string[], number] = emptyResponse(),
    nwcache: [string[], number] = emptyResponse(),
    api: [string[], number] = emptyResponse(),
    events: [string[], number] = emptyResponse();

  if (opts.sources.includes('config'))
    configseed = [config?.seed || [], Date.now()];

  // if (opts.sources.includes('static'))
  //   staticseed = await relaysFromStaticSeed(opts);

  if (opts.sources.includes('cache')) nwcache = await relaysFromCache(opts);

  if (opts.sources.includes('api')) api = await relaysOnlineFromApi(opts);

  if (opts.sources.includes('events'))
    events = await relaysFromEvents(opts, caller);

  const uniques = new Set([
    ...configseed[0],
    ...staticseed[0],
    ...nwcache[0],
    ...api[0],
    ...events[0],
  ]);

  const dates = {
    config: configseed[1],
    static: staticseed[1],
    cache: nwcache[1],
    api: api[1],
    events: events[1],
  };

  return [[...uniques], dates];
};

const emptyResponse = (): [string[], number] => [[], Date.now()];

export const relaysFromEvents = async (
  opts: any,
  caller: string
): Promise<[string[], number]> => {
  if (!opts?.options?.events?.pubkeys)
    throw new Error(
      `No pubkeys specified at 'config.${caller}.seed.options.events.pubkeys'`
    );
  if (!opts?.options?.events?.relays)
    throw new Error(
      `No relays specified at 'config.${caller}.seed.options.events.relays'`
    );
  if (!(opts.options.events.pubkeys instanceof Array))
    throw new Error(
      `'config.${caller}.seed.options.events.pubkeys' is not an array`
    );
  if (!(opts.options.events.relays instanceof Array))
    throw new Error(
      `'config.${caller}.seed.options.events.relays' is not an array`
    );

  const { NostrFetcher } = await import('nostr-fetch');
  const { simplePoolAdapter } = await import(
    '@nostr-fetch/adapter-nostr-tools'
  );
  const { SimplePool } = await import('nostr-tools');

  const pool = new SimplePool();

  const fetcher = NostrFetcher.withCustomPool(simplePoolAdapter(pool));

  const kinds = [30166];
  const authors = opts.options.events?.pubkeys || [];
  const fetchFromRelays = opts.options.events.relays || DEFAULT_RELAYS;

  const events = await fetcher.fetchAllEvents(
    fetchFromRelays,
    { kinds, authors },
    { since: 0 }
  );
  const relays: string[] = [];
  let newest = 0;
  for await (const ev of events) {
    if (ev.created_at > newest) newest = ev.created_at;
    const relay = ev.tags.find(
      (tag: string[]) => tag[0] === 'd' && !tag[0].includes('#')
    )?.[1];
    if (!relay) continue;
    relays.push(relay);
  }

  fetcher.shutdown();

  return [[...new Set(relays)], newest];
};

export const relaysFromCache = async (
  opts: any
): Promise<[string[], number]> => {
  const cacheOpts = opts?.options?.cache;
  if (!cacheOpts?.path)
    throw new Error(
      'relaysFromCache(): No cache path specified in opts (opts.cache.path)'
    );

  const { openDb, DbWrapper, initializeDb } = await import(
    '@nostrwatch/nwcache'
  );

  let result: string[] = [];

  try {
    let lmdb: any;
    if (!cache) {
      lmdb = openDb(cacheOpts.path, { maxDbs: 10 });
      cache = new DbWrapper(lmdb);
      cache = initializeDb(cache);
    }

    if (cacheOpts?.onlineOnly) {
      result = await cache.relay.get.online('url');
    } else {
      result = await cache.relay.get.all();
    }

    result = result.map((relay: any) => relay.url);
  } catch (e: any) {
    logger.err(e);
  }

  return [result, Date.now()];
};

// export const relaysFromStaticSeed = async (
//   opts: any
// ): Promise<[string[], number]> => {
//   try {
//     const STATIC_SEED_FILE = new URL('seed.yaml', import.meta.url);
//     const fileContents = await fs.readFile(STATIC_SEED_FILE, 'utf8');
//     const data = yaml.load(fileContents) as any;
//     return data?.relays ? [data.relays, Date.now()] : emptyResponse();
//   } catch (e: any) {
//     logger.err(e);
//     return emptyResponse();
//   }
// };

export const relaysOnlineFromApi = async (
  opts: any
): Promise<[string[], number]> => {
  if (!opts?.remotes?.rest_api)
    throw new Error(
      'relaysOnlineFromApi(): No nostr-watch rest_api specified in opts (host.com/v1 or host.com/v2)'
    );
  const controller = new AbortController();
  const rest_api = opts.remotes.rest_api;
  const timeout = setTimeout(() => controller.abort(), 10000);
  logger.debug('Fetching API results...');
  return new Promise<[string[], number]>((resolve) => {
    fetch(`${rest_api}/online`, { signal: controller.signal })
      .then((response: Response) => {
        if (!response.ok) {
          clearTimeout(timeout);
          resolve(emptyResponse());
          return;
        }
        response
          .json()
          .then((responseData: any) => {
            logger.debug('API results retrieved.');

            let relays: string[] = [];

            // v1
            if (Array.isArray(responseData)) {
              relays = responseData;
            }
            // v2
            else if (
              typeof responseData === 'object' &&
              responseData !== null
            ) {
              relays = responseData.relays || [];
            }

            clearTimeout(timeout);
            resolve([relays, Date.now()]);
          })
          .catch(() => {
            clearTimeout(timeout);
            resolve(emptyResponse());
          });
      })
      .catch(() => {
        clearTimeout(timeout);
        resolve(emptyResponse());
      });
  });
};
