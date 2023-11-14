export const relayPreProcess = async (relay) => {
  if(!relayQualify(relay))
    return
  relay = relaySanitize(relay)
  relay = new URL(relay)
}

export const relayQualify = (relay) => {
  if(
    relay.startsWith('wss://') &&                                  //must start with wss://
    !/^(wss:\/\/)(.*)(:\/\/)(.*)$/.test(relay) &&                  //multiple bunched together relays
    !relay.includes('http://') &&                                  //not a relay
    !relay.includes('https://') &&                                 //not a relay
    !relay.includes('.local') &&                                   //local
    !relay.includes('localhost') &&                                //local
    !/(127.)[0-9]{0,3}(.)[0-9]{0,3}(.)[0-9]{0,3}/.test(relay) &&   //local
    !/(192.168.)[0-9](.)[0-9]/.test(relay) &&                      //lan
    !/(10.)[0-9]{0,3}(.)[0-9]{0,3}(.)[0-9]{0,3}/.test(relay) &&    //lan
    !/(npub)[A-z0-9]{0,60}/.test(relay) &&                         //If it includes npub it's probably paid/private, useless to most people
    !/[\n\r]/.test(relay) &&                                       //if it has a newline don't attempt to fix it 
    !/(\[object object\])/.test(relay)                             //client bugs during relay list publish 
  )
    return true  
}

export const relaySanitize = (relay) => {
  const str = decodeURI(new String(relay))
  return str
          .toLowerCase()
          .trim()
          .replace('\t', '')
          .replace(/\s\t/g, '')
          .replace(/\/+$/, '')
          .split(',')[0]
}