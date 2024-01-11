import { loadConfig } from '@nostrwatch/utils'
let config 

if(!config)
  config = await loadConfig('trawler')

export default config