import { derived } from "svelte/store";
import { eventsArray, type StoreEventType } from "./events";

export const pubkeyMetaStore = derived(eventsArray, ($eventsArray) => {
    return $eventsArray.filter((event: StoreEventType) => {
        const metaKinds = [0, 3, 10002]
        if(metaKinds.includes(event.kind)){
            return true
        }
    })
})