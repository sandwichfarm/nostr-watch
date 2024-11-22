import { StateManager } from "@base/managers/StateManager"
import { deterministicHash } from "@base/utils/hash"

type PromiseResolver = (value?: any) => void
type SubscriberHandler = (message: string, resolve: PromiseResolver) => void

export class Subscriber {
    private _subscriptions: Set<string> = new Set()

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
            StateManager.on(hash, (message: string) => {
                handler(message, resolve); 
            });
        });
        this.subscriptions.delete(hash)
        return true
    }
}