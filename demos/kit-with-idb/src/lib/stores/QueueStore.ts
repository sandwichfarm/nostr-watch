// src/lib/stores/queueStore.ts
import { writable, get } from 'svelte/store';
import QueueWrapper from '$lib/routines/queue';

export const queueContextKey = Symbol('queueContext');

export interface QueueStore {
    subscribe: (
        this: void,
        run: import('svelte/store').Subscriber<QueueWrapper | null>,
        invalidate?: import('svelte/store').Invalidator<QueueWrapper | null> | undefined
    ) => import('svelte/store').Unsubscriber;
    registerWorker: (worker: (arg: any) => Promise<any>, concurrency?: number) => void;
    addTask: (data: any) => Promise<any>; 

}

const createQueueStore = (): QueueStore => {
    const { subscribe, set } = writable<QueueWrapper | null>(null);

    const registerWorker = (worker: (arg: any) => Promise<any>, concurrency: number = 1) => {
        const queue = new QueueWrapper(worker, concurrency);
        set(queue);
    };

    const addTask = async (data: any): Promise<any> => {
        const queueWrapper = get(queueStore); // Accessing the current value of queueStore
        if (queueWrapper) {
            return queueWrapper.addTask(data);
        }
        throw new Error('QueueWrapper is not initialized.');
    };

    return {
        subscribe,
        registerWorker,
        addTask
    };
};

export const queueStore = createQueueStore();
export const Queue = QueueWrapper;