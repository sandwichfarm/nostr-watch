import { get, writable, type Writable } from "svelte/store";
export type RelayErrorSubject = 'nip11'
export type RelayErrorMessage = string
export type RelayErrorMessages = RelayErrorMessage[]
export type RelayErrors = Map<RelayErrorSubject, RelayErrorMessages>
export type RelaysErrors = Map<string, RelayErrors>

export const relaysErrors: Writable<RelaysErrors> = writable(new Map())

export const getRelayErrors = (relay: string): RelayErrors | undefined => {
    return get(relaysErrors).get(relay)
}

export const getRelayErrorSubject = (relay: string, subject: RelayErrorSubject): RelayErrorMessages | undefined => {
    const map = getRelayErrors(relay);
    if(!map) return undefined;
    return map.get(subject) || undefined
}

export const setRelayError = (relay: string, subject: RelayErrorSubject, message: RelayErrorMessage ) => {
    const $relaysErrors = get(relaysErrors)
    let relayErrors = $relaysErrors.get(relay)
    if(relayErrors === undefined) relayErrors = new Map();
    let messages = getRelayErrorSubject(relay, subject);
    if(typeof messages === 'undefined') messages = [];
    (messages as RelayErrorMessages).push(message)
    relayErrors.set(subject, messages)
    console.log('n11s relayErrors', relay, relayErrors)
    $relaysErrors.set(relay, relayErrors)
    console.log('n11s relays errors', $relaysErrors)
    relaysErrors.set($relaysErrors);
    console.log('n11s relays errors (from store)', get(relaysErrors))
}