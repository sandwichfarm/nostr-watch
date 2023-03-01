import fetch from 'cross-fetch'
import { getEventHash } from 'nostr-tools'

export const getLnurlpData = async function(url){
  if(url.includes('@')){
    let domain = url.split('@')[1],
        user = url.split('@')[0]
    url = `https://${domain}/.well-known/lnurlp/${user}`
  }
  const res = await fetch(url)
  const json = JSON.parse(await res.text())
  if(!json?.callback)
    return 
  
  return {
    callback: json.callback,
    allowsNostr: json.allowsNostr,
    nostrPubkey: json.nostrPubkey
  }
}

export const getInvoice = async function(url, millisats, zapRequest){
  const res = await fetch(`${url}?amount=${millisats}&nostr=${encodeURIComponent(JSON.stringify(zapRequest))}`)
  const json = JSON.parse(await res.text())
  if(!json?.invoice)
    return 
  return json.invoice
}

export const makeZapRequest = async function(pubKey, relays, amount, data, comment){
  if(!pubKey || !relays || !amount || !data)
    return console.warn('missing params')

  if(!(relays instanceof Array))
    return console.warn('relays param must be array')

  const event = {
    pubkey: pubKey,
    content: comment ? comment : "",
    kind: 9734,
    created_at: Date.now(),
    tags: [
      ['p', pubKey],
      ['amount', amount],
      ['relays', ...relays]
    ]
  }
  event.id = getEventHash(event)
  return event 
}