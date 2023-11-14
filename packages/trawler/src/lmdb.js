import db from '@nostrwatch/lmdb'
import config from './config.js'

let $db

if(!config?.lmdb_path)
  throw new Error("No LMDB path specified in config")

if(!$db) {
  $db = db(config.lmdb_path)
}

export default $db