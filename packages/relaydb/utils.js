import murmurhash from 'murmurhash'

export const relayId = (relay, schema="Relay") => `${schema}@${murmurhash.v3(relay)}`
export const serviceId = (service) => `Service@${service}`
export const cacheTimeId = (key) => `CacheTime@${key}`
export const now = () => new Date().getTime()

export const ParseSelect = (OBJ, OBJSLUG) => {
  const fn = (key) => {
    if(!key)
      key = Object.keys(OBJ)
    if(key instanceof Object && !(key instanceof Array))
      return key
    if(key == 'id')
      key = '#'
    if(typeof key === 'string')
      key = [key]
    const select = { [OBJSLUG]: {} }
    key.push('#')
    for (const k of key) {
      // select.Relay[k] = (value,{root}) => { root[k]=value; }
      select[OBJSLUG][k] = (value,{root}) => {  root[k] = value; }
    }
    return select
  }
  return fn
}

export const helperHandler = (fns, validator=null) => {
  const _ = (..._args) => {
    const fnkey = _args[0]
    const args = Array.from(_args).slice(1)
    if(validator && !validator(...args)) return
    return fns[fnkey](...args)
  }

  const $fns = {}
  Object.keys(fns).forEach(fnkey => {
    if(fns[fnkey] instanceof Function)
      $fns[fnkey] = (...args) => _(fnkey, ...args)
  })
  return $fns
}