import { IEvent, NostrEvent } from "./Event";
import type { Nip05 } from "nostr-tools/nip05";

export class PubkeyProfile extends NostrEvent {

    private _parsed?: any;

    constructor(event: IEvent) {
        super(event)
        try {
            this.parsed = JSON.parse(this.content);
        }
        catch(e){
            this.parsed = {}
        }
    }

    get name(): string | undefined {
        return this.parsed?.name
    }

    get photo(): string | undefined {
        return this.parsed?.photo || this.parsed?.picture
    }

    get picture(): string | undefined {
        return this.photo 
    }

    get about(): string | undefined {
        return this.parsed?.about
    }

    get website(): string | undefined {
        return this.parsed?.website
    }

    get banner(): string | undefined {
        return this.parsed?.banner
    }

    get lud06(): string | undefined {
        return this.parsed?.lud06
    }

    get lud16(): string | undefined {
        return this.parsed?.lud16
    }

    get nip05(): Nip05 | undefined {
        return this.parsed?.nip05
    }

    get parsed(): any {
        return this._parsed;
    }

    set parsed(value: any) {
        this._parsed = value;
    }

}