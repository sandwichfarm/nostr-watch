import { get, readable, writable, type Writable } from "svelte/store";
import RelayCountry from "../components/partials/relay-single/RelayCountry.svelte";
import type { Readable } from "svelte/store";
import { nip66 } from '$lib/stores/nip66'
import type Nip66 from "@nostrwatch/nip66"

const activityStrings: Readable<Record<string, string>> = readable({
    'monitors': 'running branl.',
    'monitors/bootstrap': 'Bootstrapping relay monitors...',
    'monitors/bootstrap/registrations': 'Finding relay monitors',
    'monitors/bootstrap/meta': 'Fetching their metadata',
    'monitors/bootstrap/ensureActive': 'Scanning for active monitors',
    'monitors/bootstrap/checks': 'Syncing relay monitor checks'
})

let $activityStrings = get(activityStrings)
let $nip66: Nip66;
let bound: boolean = false;

nip66.subscribe( (n66: Nip66) => { 
    if(!n66) return;
    $nip66 = n66 
    $nip66.ready().then( () => {
        if(bound) return;
        $nip66.on('activity', bindActivities);
        bound = true;
    })
})

export type ActivityItem = {
    slug: string;
    text: string;
    index: number;
    complete: boolean;
    value?: any;
}

const defaultActivityItem = {
    slug: 'unset',
    text: 'no text?',
    index: -1,
    complete: false
}

export type ActivityItems = Map<string, ActivityItem>;

export const activity: Writable<ActivityItems> = writable(new Map())

const bindActivities = (...args: any[]) => {
    const slug = args?.[0]
    const action = args?.[1]
    const data = args?.[2]

    let value: any;

    if(action === 'update') {
        value = data.value
    }
    else {
        value = data;
    }

    if(action === 'begin'){
        addActivity({
            ...defaultActivityItem,
            slug,
            text: $activityStrings[slug]
        })
    }

    if(action === 'update'){
        updateActivity(slug, { value })
    }

    if(action === 'finish'){
        const complete = true;
        updateActivity(slug, { complete })
    }
}

export const addActivity = ( item: ActivityItem ) => {
    const $activity: ActivityItems = get(activity)
    const length = Object.keys($activity).length
    item.index = length
    $activity.set(item.slug, item)
    activity.set($activity);
}

export const updateActivity = ( slug: string, item:Partial<ActivityItem> ) => {
    const $activity = get(activity)
    const foundItem = $activity.get(slug)
    if(!foundItem) return console.warn('No activities with slug:', slug)
    $activity.set(slug, {...foundItem, ...item})
    activity.set($activity);
}