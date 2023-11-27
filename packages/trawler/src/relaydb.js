import rdb from '@nostrwatch/relaydb'
import config from './config.js'

let $rdb

if(!config?.lmdb_path)
  throw new Error("No LMDB path specified in config")

if(!$rdb) {
  $rdb = rdb(config.lmdb_path)
}

export default $rdb