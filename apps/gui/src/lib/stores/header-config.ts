import { derived, writable, readable, get, type Writable } from 'svelte/store'

interface HeaderConfigStore {
    showDataViewModifiers?: true;
}

export const HeaderConfigStore: Writable<HeaderConfigStore> = writable({})