import rcache from '@nostrwatch/nwcache'
import config from './config.js'

let $rcache

console.log(process.env.PWD, process.cwd())
console.log('config', config)

if(!config?.cache_path)
  throw new Error("No LMDB path specified in config")

if(!$rcache) {
  $rcache = rcache(config.cache_path)
}

export default $rcache