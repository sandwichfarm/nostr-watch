import { getSeedStatic } from "@nostrwatch/seed"
import rcache from "./relaydb.js"
import config from "./config.js"
import Logger from "@nostrwatch/logger"
import { fetch } from "cross-fetch"

const logger = new Logger('bootstrap')

export const bootstrap = async () => {
  let configseed = [],
      staticseed = [], 
      cache = [], 
      api = []

  if(config.seed_sources.includes('config') && config?.seed instanceof Array)
    configseed = config?.seed

  if(config.seed_sources.includes('static'))
    staticseed = await relaysFromStaticSeed()

  if(config.seed_sources.includes('cache'))
    cache = await relaysOnlineFromCache()

  if(config.seed_sources.includes('api'))
    api = await relaysOnlineFromApi()

  const uniques = new Set([...configseed, ...staticseed, ...cache, ...api])

  logger.info(`Bootstrapped ${uniques.size} relays`)

  return [...uniques]
}

export const relaysFromStaticSeed = async () => {
  return getSeedStatic()
}

export const relaysOnlineFromApi = async () => {
  const controller = new AbortController();
  let timeout = setTimeout( () => controller.abort(), 10000)
  let found = false
  logger.debug('api results retrieved.')
  return new Promise( resolve => {
    fetch(`${config.remotes.rest_api}/online`, {signal: controller.signal  })
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

export const relaysOnlineFromCache = async () => {
  return rcache.relay.get.online()
}