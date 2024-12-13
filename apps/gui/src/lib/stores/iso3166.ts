import { iso31661, iso31662, iso31663, iso31661Alpha2ToAlpha3} from 'iso-3166'
import type { Readable } from 'svelte/motion'
import { derived, get, readable } from 'svelte/store'
import type { ISO31661Entry, ISO31662Entry, ISO31663Entry } from 'iso-3166'

export type ISO3166Entry = {
    type: 'ISO31661' | 'ISO31662' | 'ISO31663',
    format: 'alpha2' | 'alpha3' | 'numeric',
    value: string | number
}

export const getCountryName = (code: string): string | undefined => {
    if(typeof code === 'string') {
        let type = null
        const len = code.length 
        if(len === 2 || len === 3) {
            type = `alpha${len}`
        }
        if(!type) return
        return iso31661.find( (entry: ISO31661Entry) => entry[type as keyof ISO31661Entry] === code)?.name || undefined
    }
    else if(typeof code === 'number') {
        return iso31661.find( (entry: ISO31661Entry) => entry?.numeric === code)?.name || undefined
    }
    return;
}