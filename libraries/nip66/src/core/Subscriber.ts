import { deterministicHash } from "@base/utils/hash"
import { EventEmitter } from "tseep"
import { SubscribeHandlers } from "."

type PromiseResolver = (value?: any) => void
type SubscriberHandler = (message: string, resolve: PromiseResolver) => void

export class Subscriber {
    private _subscriptions: Set<string> = new Set()
    private emitter: EventEmitter = new EventEmitter()

    get subscriptions(): Set<string> {
        return this._subscriptions
    }

    request(subject: any): string {
        const hash = deterministicHash(subject ?? {})
        this.subscriptions.add(hash)
        return hash
    }

    async response( hash: string, handler: SubscriberHandler ): Promise<boolean | any[]> {
        await new Promise((resolve) => {
            this.emitter.on(hash, (message: string) => {
                handler(message, resolve); 
            });
        });
        this.subscriptions.delete(hash)
        return true
    }
}