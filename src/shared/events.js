import crypto from 'crypto',

import { validateEvent, verifySignature, signEvent } from 'nostr-tools'

const events = {}

export const hasNip07Extension = async function(){
  if(window.nostr instanceof Object)
    return true
}

export const getPubKey = async function(){
  return await window.nostr.getPublicKey()
}

export const signEvent = async function(event){
  return await window.nostr.signEvent(event)
}

export const eventIsValid = async function(signedEvent){
  if(verifySignature(signedEvent) && validateEvent(signedEvent))
    return true
}

export default Events