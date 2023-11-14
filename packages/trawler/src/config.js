import { loadConfig } from '@nostrwatch/utils'
let config 

if(!config)
  config = await loadConfig('crawler')

export default config