import murmurhash from 'murmurhash'

export const relayId = (relay, schema="Relay") => `${schema}@${murmurhash.v3(relay)}`
export const serviceId = (service) => `Service@${service}`
export const cacheTimeId = (key) => `CacheTime@${key}`
export const now = () => new Date().getTime()
import { ResultInterface } from "@nostrwatch/nocap";

export const parseSelect = (key) => {
  const $ResultType = new ResultInterface()
  if(!key)
    key = Object.keys($ResultType).filter(key => typeof key !== 'function' && key !== 'defaults')
  if(key instanceof Object && !(key instanceof Array))
    return key
  if(key == 'id')
    key = '#'
  if(typeof key === 'string')
    key = [key]
  const select = { Relay: {} }
  for (const k of key) {
    select.Relay[k] = (value,{root}) => { root[k]=value; }
  }
  return select
}

export const helperHandler = (fn, validator=null) => {
  const _ = (..._args) => {
    const fnkey = _args[0]
    const args = Array.from(_args).slice(1)
    if(validator && !validator(...args)) return
    return fn[fnkey](...args)
  }

  const $fns = {}
  Object.keys(fn).forEach(fnkey => {
    if(fn[fnkey] instanceof Function)
      $fns[fnkey] = (...args) => _(fnkey, ...args)
  })
  return $fns
}