import type { UserService } from "$lib/services/UserService";
import { PubkeyProfile, PubkeyRelays, type IEvent } from "@nostrwatch/nip66/models";
import { nip19, type NostrEvent } from "nostr-tools";

export type Pubkey = string;

export class User {
    #profile?: PubkeyProfile;
    #relays?: PubkeyRelays;
    #pubkey: Pubkey;    
    #ready: boolean = false;
    #service?: UserService;

    constructor(pubkey: Pubkey, service?: UserService){
        this.#pubkey = pubkey;
        if(service){
            this.#service = service;
            this.initialize();
            console.log('User initialized with service');
        }
        else {
            console.log('User initialized without service');
            this.#ready = true;
        }
    }

    async initialize(): Promise<void> {
        if(!this.#service) return;
        this.#service.meta(this).then( (metas: IEvent[]) =>{
            for(const meta of metas){
                if( meta.kind === 0) this.#profile = new PubkeyProfile(meta);
                if( meta.kind === 10002 ) this.#relays = new PubkeyRelays(meta);
            }
            console.log('user initialize', metas);
            this.#ready = true;
        })
    }

    async ready(): Promise<void> {
        while(!this.#ready){
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    get pubkey(): Pubkey {
        return this.#pubkey;
    }

    get profile(): PubkeyProfile | undefined {
        return this.#profile;
    }

    get name(): string | undefined {
        return this.#profile?.name;
    }

    get lud06(): string | undefined {
        return this.#profile?.lud16
    }

    get lud16(): string | undefined {
        return this.#profile?.lud16
    }

    get lnaddr(): string | undefined{
        return this.#profile?.lud16
    }

    get photo(): string | undefined {
        return this.#profile?.photo;
    }

    get image(): string | undefined {
        return this.photo;
    }

    get picture(): string | undefined {
        return this.photo;
    }

    get banner(): string | undefined {
        return this.#profile?.banner
    }

    get relays(): string[] | undefined {
        return this.#relays?.relays
    }

    get reference(): string | undefined {
        const pointer: nip19.ProfilePointer = {
            pubkey: this.#pubkey,
            relays: this.relays
        }
        return nip19.nprofileEncode(pointer)
    }
}