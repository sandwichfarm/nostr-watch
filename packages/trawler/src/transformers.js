export const serializeCategorizedRelays = (relaysCategorized) => {
  const relaysSerialized = new Array() 
  
  for ( const [key, relays] of Object.entries(relaysCategorized) ) {
    const serializedList = relays.map( relay => {
      return {
        url: relay,
        network: key
      }
    })
    relaysSerialized = [ ...relaysSerialized, ...serializedList ]
  }
  
  return relaysSerialized
}