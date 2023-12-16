import fs from 'fs/promises'
import yaml from 'js-yaml'

import { extractConfig } from "@nostrwatch/utils"
import Logger from "@nostrwatch/logger"
import { fetch } from "cross-fetch"
import config from "./config.js"

const STATIC_SEED_FILE = new URL('seed.yaml', import.meta.url);

const logger = new Logger('@nostrwatch/seed')

export const bootstrap = async (caller) => {
  const opts = await extractConfig(caller, 'seed')

  if(!Object.keys(opts).length === 0)
    return logger.warn(`Skipping seed because there is no seeed config`)

  if(!opts?.sources)
    return logger.warn(`No seed sources specified in 'config.${caller}.seed.sources' nor in 'config.seed.sources', cannot seed`)

  let configseed = [],
      staticseed = [], 
      nwcache = [], 
      api = [],
      events = []

  console.log(opts.sources, opts.sources.includes('api'))

  if(opts.sources.includes('config'))
    configseed = config?.seed

  if(opts.sources.includes('static'))
    staticseed = await relaysFromStaticSeed(opts)

  if(opts.sources.includes('nwcache'))
    nwcache = await relaysOnlineFromCache(opts)

  if(opts.sources.includes('api'))
    api = await relaysOnlineFromApi(opts)

  if(opts.sources.includes('events'))
    events = await relaysFromEvents(opts)

  const uniques = new Set([...configseed, ...staticseed, ...nwcache, ...api, ...events])

  logger.info(`Bootstrapped ${uniques.size} relays`)

  return [...uniques]
}

export const relaysFromEvents = async (opts) => {
  if(!opts?.options?.events?.pubkeys)
    throw new Error(`No pubkeys specified at 'config.${caller}.seed.options.events.pubkeys'`)
  if(!opts?.options?.events?.relays)
    throw new Error(`No relays specified at 'config.${caller}.seed.options.events.relays'`)
  if(!(opts.options.events.pubkeys instanceof Array))
    throw new Error(`'config.${caller}.seed.options.events.pubkeys' is not an array`)
  if(!(opts.options.events.relays instanceof Array))
    throw new Error(`'config.${caller}.seed.options.events.relays' is not an array`)

  const { NostrFetcher } = await import("nostr-fetch")
  const { simplePoolAdapter } = await import("@nostr-fetch/adapter-nostr-tools")
  const { SimplePool } = await import("nostr-tools")

  const pool = new SimplePool();

  const fetcher = NostrFetcher.withCustomPool(simplePoolAdapter(pool));

  const kinds = [ 30066 ]
  const authors = opts.options.events.publisherPubKeys
  const fetchFromRelays = opts.options.events.relays

  const events = await fetcher.fetchAllEvents(
    fetchFromRelays,
    { kinds, authors },
    { since: 0 }
  )
  const relays = []
  for await(const ev of events) {
    const relay = ev.tags.find( tag => tag[0] === 'd' && !tag[0].includes('#') )?.[1]
    if(!relay) continue
    relays.push(relay)
  }
  return [...new Set(relays)]
}

export const relaysOnlineFromCache = async (opts) => {
  const { default: nwcache } = await import("@nostrwatch/relaycache")
  const $nwcache = nwcache(process.env.NWCACHE_PATH)
  return $nwcache.relay.get.online('url').map( relay => relay.url )
}

export const relaysFromStaticSeed = async (opts) => {
  try {
    const fileContents = await fs.readFile(STATIC_SEED_FILE, 'utf8');
    const data = yaml.load(fileContents);
    return data?.relays || [];
  } catch (e) {
    console.error(e);
    return []
  }
}

export const relaysOnlineFromApi = async (opts) => {
  if(!opts.remotes.rest_api) throw new Error("relaysOnlineFromApi(): No nostr-watch rest_api specified in opts (host.com/v1 or host.com/v2)")
  const controller = new AbortController();
  const rest_api = opts.remotes.rest_api
  let timeout = setTimeout( () => controller.abort(), 10000)
  let found = false
  logger.debug('api results retrieved.')
  return new Promise( resolve => {
    fetch(`${rest_api}/online`, { signal: controller.signal  })
      .then((response) => {
        if (!response.ok) {
          resolve()
          clearTimeout(timeout)
          resolve([])
        }
        response.json()
          .then( response => {
            found = true
            logger.debug('api results retrieved.')

            let relays

            //v1
            if(response instanceof Array) {
              relays = response
            }
            //v2
            else if (response instanceof Object) {
              relays = response.relays //presumed
            }

            resolve(relays)

            clearTimeout(timeout)
          })
          .catch( () => {
            resolve([])
            clearTimeout(timeout)
          })
      })
      .catch( () => { 
        resolve([])
        clearTimeout(timeout)
      })
  })
}
