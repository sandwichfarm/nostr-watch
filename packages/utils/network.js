/**
 * Network Configuration
 */

const networks = {};

//clearnet is default
networks.tor = url => { 
  try {
    return new URL(url).hostname.endsWith('.onion')
  }
  catch(e){ return false }
}
  
networks.i2p = url => {
  try {
    return new URL(url).hostname.endsWith('.i2p')
  }
  catch(e){ return false }
}
  
networks.cjdns = url => {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.startsWith('fc00:') || hostname.startsWith('fc01:'))
      return true;
  } catch (e) {}
  return false;
}

/** */
const parseRelayNetwork = (url) => {
  for (const network in networks) {
    if (networks[network](url))
      return network
  }
  return 'clearnet' 
}

const relaysSerializedByNetwork = (urls) => {
  const result = {};
  urls.forEach(url => {
      network = parseRelayNetwork(url)
      if(!result?.[network])
        result[network] = []
      result[network].push(url);
  });
  return result;
}

export default {
  parseRelayNetwork,
  relaysSerializedByNetwork
}