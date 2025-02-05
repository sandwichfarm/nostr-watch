import { derived, get, writable, type Readable, type Writable } from "svelte/store";
export type RelayErrorType = 'resolve' | 'schema'
export type RelayErrorSubject = string;
export type RelayErrorMessage = string
export type RelayErrorMessages = RelayErrorMessage[]
export type RelayErrors = Map<RelayErrorSubject, RelayErrorMessages>
export type RelaysErrorsMap = Map<string, RelayErrors>

export const relaysErrors: Writable<RelaysErrorsMap> = writable(new Map())

export const getRelayErrors = (relay: string): RelayErrors | undefined => {
    return get(relaysErrors).get(relay) || new Map()
}

export const getRelayErrors$ = (relay: string): Readable<RelayErrors> => {
    return derived(relaysErrors, ($relaysErrors) => {
        return $relaysErrors.get(relay) || new Map()
    })
}

const key = (subject: RelayErrorSubject, type: RelayErrorType) => `${subject}:${type}`

export const getRelayErrorSubject = (relay: string, type: RelayErrorType, subject: RelayErrorSubject): RelayErrorMessages => {
    const map = getRelayErrors(relay);
    if(!map) return [];
    return map.get(key(subject, type)) || []
}

export const getRelayErrorSubject$ = (relay: string, type: RelayErrorType, subject: RelayErrorSubject): Readable<RelayErrorMessages> => {
    return derived(getRelayErrors$(relay), ($errors) => {
        if(!$errors) return [];
        return $errors.get(key(subject, type)) || []
    })
}

const deduplicateMessages = (input: string[]): string[] => {
    return Array.from(new Set(input))
}

export const setRelayError = (relay: string, type: RelayErrorType, subject: RelayErrorSubject, message: RelayErrorMessage ) => {
    const relaysErrorsMap = get(relaysErrors)
    let relayErrors = relaysErrorsMap.get(relay) || new Map()
    let messages = getRelayErrorSubject(relay, type, subject);
    messages.push(message)
    // (messages as RelayErrorMessages).push(message)
    relayErrors.set(`${type}:${subject}`, messages)
    console.log('relayErrors', subject, relay, relayErrors)
    relaysErrorsMap.set(relay, relayErrors)
    console.log('relayErrors', subject, relaysErrorsMap)
    relaysErrors.update(() => relaysErrorsMap);
    console.log('relayErrors (from store)', get(relaysErrors))
}