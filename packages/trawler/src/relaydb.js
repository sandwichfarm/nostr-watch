import rcache from '@nostrwatch/nwcache'
import config from "./config.js"

let $rcache

// console.log(process.env.PWD, process.cwd())
// console.log('config', config)

if(!process.env.NWCACHE_PATH)
  throw new Error("NWCACHE_PATH, the path to the nostr watch LMDB cache, was not specified in the environment.")

if(!$rcache) {
  $rcache = rcache(process.env.NWCACHE_PATH)
}

export default $rcache