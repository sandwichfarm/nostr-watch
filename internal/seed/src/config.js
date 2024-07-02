import { loadConfig } from '@nostrwatch/utils'

let config 
if(!config)
  config = await loadConfig('seed')

export default config