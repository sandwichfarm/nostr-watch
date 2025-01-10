import { get, writable, type Writable } from "svelte/store";
export type RelayErrorType = 'resolve' | 'schema'
export type RelayErrorSubject = string;
export type RelayErrorMessage = string
export type RelayErrorMessages = RelayErrorMessage[]
export type RelayErrors = Map<RelayErrorSubject, RelayErrorMessages>
export type RelaysErrors = Map<string, RelayErrors>

export const relaysErrors: Writable<RelaysErrors> = writable(new Map())

export const getRelayErrors = (relay: string): RelayErrors | undefined => {
    return get(relaysErrors).get(relay)
}

export const getRelayErrorSubject = (relay: string, type: RelayErrorType, subject: RelayErrorSubject): RelayErrorMessages | undefined => {
    const map = getRelayErrors(relay);
    if(!map) return undefined;
    return map.get(`${type}:${subject}`) || undefined
}

export const setRelayError = (relay: string, type: RelayErrorType, subject: RelayErrorSubject, message: RelayErrorMessage ) => {
    const $relaysErrors = get(relaysErrors)
    let relayErrors = $relaysErrors.get(relay)
    if(relayErrors === undefined) relayErrors = new Map();
    let messages = getRelayErrorSubject(relay, type, subject);
    if(typeof messages === 'undefined') messages = [];
    (messages as RelayErrorMessages).push(message)

    relayErrors.set(`${type}:${subject}`, messages)
    console.log('relayErrors', subject, relay, relayErrors)
    $relaysErrors.set(relay, relayErrors)
    console.log('relayErrors', subject, $relaysErrors)
    relaysErrors.set($relaysErrors);
    console.log('relayErrors (from store)', get(relaysErrors))
}