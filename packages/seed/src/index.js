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

  let configseed = emptyResponse(),
      staticseed = emptyResponse(), 
      nwcache = emptyResponse(), 
      api = emptyResponse(),
      events = emptyResponse()

  console.log(opts.sources, opts.sources.includes('api'))

  if(opts.sources.includes('config'))
    configseed = [ config?.seed, Date.now() ]

  if(opts.sources.includes('static'))
    staticseed = await relaysFromStaticSeed(opts)

  if(opts.sources.includes('nwcache'))
    nwcache = await relaysOnlineFromCache(opts)

  if(opts.sources.includes('api'))
    api = await relaysOnlineFromApi(opts)

  if(opts.sources.includes('events'))
    events = await relaysFromEvents(opts)

  const uniques = new Set([...configseed[0], ...staticseed[0], ...nwcache[0], ...api[0], ...events[0]])

  const dates = { config: configseed[1], static: staticseed[1], cache: nwcache[1], api: api[1], events: events[1] }

  return [ [...uniques], dates]
}

const emptyResponse = () => [[], Date.now()]

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
  let newest = 0
  for await(const ev of events) {
    if(ev.created_at > newest) newest = ev.created_at
    const relay = ev.tags.find( tag => tag[0] === 'd' && !tag[0].includes('#') )?.[1]
    if(!relay) continue
    relays.push(relay)
  }
  return [[...new Set(relays)], newest]
}

export const relaysOnlineFromCache = async (opts) => {
  const { default: nwcache } = await import("@nostrwatch/nwcache")
  const $nwcache = nwcache(process.env.NWCACHE_PATH)
  return [ $nwcache.relay.get.online('url').map( relay => relay.url ), Date.now() ]
}

export const relaysFromStaticSeed = async (opts) => {
  try {
    const fileContents = await fs.readFile(STATIC_SEED_FILE, 'utf8');
    const data = yaml.load(fileContents);
    return data?.relays? [ data.relays, Date.now() ]: emptyResponse() //update Date to reflect modification date of seed file.
  } catch (e) {
    console.error(e);
    return emptyResponse()
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

            resolve([relays, Date.now()])

            clearTimeout(timeout)
          })
          .catch( () => {
            resolve(emptyResponse())
            clearTimeout(timeout)
          })
      })
      .catch( () => { 
        resolve(emptyResponse())
        clearTimeout(timeout)
      })
  })
}
