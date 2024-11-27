import { type IEvent } from '@nostrwatch/nip66/models';
import { nip66 } from '$lib/stores/nip66.js';
import { events } from '$lib/stores/events.js';
import { eventKey } from '$lib/utils/event-keys.js';
import { get } from 'svelte/store';

export default () => {
    const $nip66 = get(nip66)
    const monitors = $nip66.monitors.monitors;

    // events.update( $events => {
    //     $events.forEach( (event: IEvent) => {
    //         if(event.kind !== 30166) return;
    //         const monitor = monitors.get(event.pubkey);
    //         if(monitor.relayIsOffline(event)) {
    //             const key = eventKey(event)
    //             $events.delete(key)
    //         }
    //     })
    //     return $events
    // })
}