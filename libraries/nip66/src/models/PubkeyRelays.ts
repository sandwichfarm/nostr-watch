import { NostrEvent } from "./Event";

export class PubkeyRelays extends NostrEvent {

    get relays(): string[] {
        return this.json.tags.filter(tag => tag[0] === 'r').map(tag => tag[1]);
    }
    
}