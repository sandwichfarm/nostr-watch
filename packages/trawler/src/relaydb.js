import rcache from '@nostrwatch/relaycache'
import config from './config.js'

let $rcache

if(!config?.lmdb_path)
  throw new Error("No LMDB path specified in config")

if(!$rcache) {
  $rcache = rcache(config.lmdb_path)
}

export default $rcache