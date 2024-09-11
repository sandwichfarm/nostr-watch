import murmurhash from 'murmurhash'
import 'dotenv/config'
import network from './network.js'

export { getEnvValue, setEnvValue } from './env-tools.js'
export { loadConfig, extractConfig } from './config.js'

// export { env } from './env.js'

let { DAEMON_PUBKEY } = process?.env || {};
DAEMON_PUBKEY = DAEMON_PUBKEY? DAEMON_PUBKEY : 'WARNING_DAEMON_PUBKEY_UNSET';

if(typeof process !== 'undefined' && process?.env && process.env instanceof Object){
  console.log('env dump:')
  Object.keys(process.env).forEach( key => { console.log( key, process.env[key]) })
}

export { DAEMON_PUBKEY }
export const isBrowser = () => (typeof window !== 'undefined' && typeof document !== 'undefined')
export const parseRelayNetwork = network.parseRelayNetwork
export const relaysSerializedByNetwork = network.relaysSerializedByNetwork
export const hashRelay = (relay) => murmurhash.v3(relay)
export const relayId = (relay, schema="Relay") => `${schema}@${hashRelay(relay)}`
export const serviceId = (service) => `Service@${service}`
export const cacheTimeId = (key) => `CacheTime@${key}`
export const noteId = (key) => `Note@${key}`
export const lastCheckedId = (key, relay) => `${DAEMON_PUBKEY}:LastChecked:${key}:${relay}`
export const now = () => new Date().getTime()
export const nowstr = () => Math.round(now()/1000)
export const delay = async (ms) => new Promise(resolve => setTimeout(resolve, ms))
export const devnull = () => {}

export const RedisConnectionDetails = () => {
  const redis = {}
  Object.keys(process.env).forEach(key => {
    if(key.startsWith('REDIS_'))
      redis[key.replace('REDIS_', '').toLowerCase()] = process.env[key]
  })
  if(redis?.tls === "true") redis.tls = {}
  return redis
}


export const shuffleArray = (array) => {
  let currentIndex = array.length;

  // While there remain elements to shuffle...
  while (currentIndex != 0) {

    // Pick a remaining element...
    let randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
}


export const chunkArray = (arr, chunkSize) => {
  shuffleArray(arr)
  if (chunkSize <= 0) {
    throw new Error("Chunk size must be greater than 0.");
  }
  const result = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.slice(i, i + chunkSize);
    result.push(chunk);
  }
  return result;
}

export const msToCronTime = (milliseconds) => {
  if (!Number.isInteger(milliseconds) || milliseconds < 0) {
      return 'Invalid input';
  }
  let minutes = Math.ceil(milliseconds / 60000);
  if (minutes >= 60) {
      let hours = Math.ceil(minutes / 60);
      return `0 */${hours} * * *`;
  } else {
      return `*/${minutes} * * * *`;
  }
}

export const capitalize = (str) => {
  return str.charAt(0).toUpperCase()+str.slice(1);
}


export const isObject = (item) => {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

export const deepCopy = (obj) => {
  if (isObject(obj)) {
    const copy = {};
    Object.keys(obj).forEach((key) => {
      copy[key] = deepCopy(obj[key]);
    });
    return copy;
  } else if (Array.isArray(obj)) {
    return obj.map((item) => deepCopy(item));
  }
  return obj;
}