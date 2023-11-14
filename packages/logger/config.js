import { loadConfig } from '@nostrwatch/utils'

let config

if(!config)
  config = await loadConfig('logger')

export default config