export const bootstrap = async () => {
  const seed = await relaysGetSeed()
  const online = await relaysOnline()
  const found = await relaysSample()
  const uniques = new Set([...online, ...seed, ...found])
  return Array.from(uniques)
}

export const relaysGetSeed = async () => {
  const controller = new AbortController();
  let timeout = setTimeout( () => controller.abort(), 10000)
  return new Promise( resolve => {
    fetch(process.env.DISCOVERY_REMOTE_BOOTSTRAP_JSON, {signal: controller.signal})
      .then((response) => {
        if (!response.ok) {
          clearTimeout(timeout)
          resolve(false)
          return
        }
        response.json()
          .then( json => {
            found = true
            console.log('bootstrap results retrieved.')
            clearTimeout(timeout)
            resolve(json.relays)
          })
          .catch( () => {
            clearTimeout(timeout)
            resolve(false)
          })
      })
      .catch( () => { 
        clearTimeout(timeout)
        resolve(false)
      })
  })
}

export const relaysOnline = async (method) => {
  switch(method) {
    case "db":
      return await relaysOnlineFromDb()
    case "api":
    default:
      return await relaysOnlineFromApi()
  }
}

export const relaysOnlineFromApi = async () => {
  console.log('calling api')
  const controller = new AbortController();
  let timeout = setTimeout( () => controller.abort(), 10000)
  let found = false
  await new Promise( resolve => {
    fetch(`${process.env.DISCOVERY_REMOTE_REST_API}/v1/online`, {signal: controller.signal  })
      .then((response) => {
        if (!response.ok) {
          resolve()
          clearTimeout(timeout)
          return
        }
        response.json()
          .then( json => {
            found = true
            console.log('api results retrieved.')
            resolve(json)
            clearTimeout(timeout)
          })
          .catch( () => {
            resolve()
            clearTimeout(timeout)
          })
      })
      .catch( () => { 
        resolve()
        clearTimeout(timeout)
      })
  })
  return found 
}

export const relaysOnlineFromDb = async () => {
  //query db
}