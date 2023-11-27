import murmurhash from 'murmurhash'

export const relayId = (relay, schema="Relay") => `${schema}@${murmurhash.v3(relay)}`
export const serviceId = (service) => `Service@${service}`
export const cacheTimeId = (key) => `CacheTime@${key}`
export const now = () => new Date().getTime()