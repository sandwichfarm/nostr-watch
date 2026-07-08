import { get, writable, type Writable } from "svelte/store";

export type SubscriptionHandler = () => Promise<undefined>;

const defaultHandler = async (): Promise<undefined> => {}

export const subscriptions: Writable<Map<string, SubscriptionHandler>> = writable(new Map()); 

export const addSubscription = (subId: string, handler: SubscriptionHandler = defaultHandler ) => {
    subscriptions.update((map) => {
        map.set(subId, handler);
        return map;
    });
}

const unsub = async (subId: string, handler: SubscriptionHandler) => {
    if(handler) {
        await handler();
    }
    subscriptions.update((map) => {
        map.delete(subId);
        return map;
    });
}

export const unsubscribe = async (subId: string) => {
    const handler = get(subscriptions).get(subId);
    if(!handler) return;
    unsub(subId, handler);
}


export const unsubscribeAll = async () => {
    for(const [subId, handler] of get(subscriptions)) {
        unsub(subId, handler);
    }
    subscriptions.set(new Map());
}

export const hasSubscription = (subId: string): boolean => {
    return get(subscriptions).get(subId)? true: false;
}

export const hasSubscriptions = (): boolean => {
    return get(subscriptions).size > 0;
}

export const clearSubscriptions = () => {
    subscriptions.set(new Map());
}
