export const publishEvent = async function(relays, signedEvent){
    if(relays instanceof String)
      relays = [relays]
    const pool = new RelayPool(relays)
    pool
      .on('open', $relay => {
        $relay.send(signedEvent)
      })
      .close()
}

export const poolSubscribe = async function(relays, filters){
    if(relays instanceof String)
        relays = [relays]
    const pool = new RelayPool(relays)
    pool
        .on('open', $relay => {
            $relay.subscribe(filters)
        })
    return pool
}