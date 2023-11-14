import fs from 'fs/promises';
import yaml from 'js-yaml';
import murmurhash from 'murmurhash'
import 'dotenv/config'
import network from './network.js'

export const parseRelayNetwork = network.parseRelayNetwork
export const relaysSerializedByNetwork = network.relaysSerializedByNetwork

export const hashRelay = (relay) => murmurhash.v3(relay)
export const relayId = (relay, schema="Relay") => `${schema}@${hashRelay(relay)}`
export const serviceId = (service) => `Service@${service}`
export const cacheTimeId = (key) => `CacheTime@${key}`
export const noteId = (key) => `Note@${key}`

export const now = () => new Date().getTime()
export const nowstr = () => Math.round(now()/1000)

export const devnull = () => {}

export const RedisConnectionDetails = function(){
  const env = {}
  Object.keys(process.env).forEach(key => {
    if(key.startsWith('REDIS_'))
      env[key.replace('REDIS_', '').toLowerCase()] = process.env[key]
  })
  console.log(env)
  return env
}

export const loadConfigSync = function(key){
  try {
    const configPath = process.env.DOCKER == 'true' ? `/etc/@nostrwatch/${key}/config.yaml` : process.env.CONFIG_PATH
    if(!configPath)
      throw new Error(`No config path set for ${key} config file`)
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const data = yaml.load(fileContents);
    if(data?.[key])
      data = data.package
    return data;
  } catch (e) {
      console.error(e);
      return {};
  }
}

export const loadConfig = async function (key){
  try {
    if(!process.env?.CONFIG_PATH)
      return {}
    const fileContents = await fs.readFile(process.env.CONFIG_PATH, 'utf8');
    let data = yaml.load(fileContents);
    if (data?.[key]) {
      data = data[key];  // Assuming you want to access 'key' in data
    }
    return data;
  } catch (e) {
    console.error(e);
    return {};
  }
}

