import { events, type StoreEventType } from "../events";

export const resetStores = () => {
    events.set(new Map<string, StoreEventType>());
}