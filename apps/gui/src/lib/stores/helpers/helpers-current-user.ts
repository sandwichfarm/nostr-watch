import { derived, get, type Readable } from "svelte/store"
import { currentUser } from "../memory-relays/memory-relay-current-user"

export const userIsAuthed = (): boolean => {
    return !!get(currentUser)
}

export const userIsAuthed$ = (): Readable<boolean> => {
    return derived(currentUser, ($currentUser) => {
        return !!$currentUser
    })
}