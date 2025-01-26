import type { UserService } from "$lib/services/UserService";
import { PubkeyProfile, PubkeyRelays, type IEvent } from "@nostrwatch/route66/models";
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
        }
        else {
            this.#ready = true;
        }
    }

    static from(profile: IEvent, relays: IEvent): User {
        const instance = new User(profile.pubkey);
        instance.#profile = new PubkeyProfile(profile);
        instance.#relays = new PubkeyRelays(relays);
        instance.forceReady();
        return instance;
    }

    async initialize(): Promise<void> {
        if(!this.#service) return;
        this.#service.meta(this).then( (metas: IEvent[]) =>{
            for(const meta of metas){
                if( meta.kind === 0) this.#profile = new PubkeyProfile(meta);
                if( meta.kind === 10002 ) this.#relays = new PubkeyRelays(meta);
            }
            //////console.log('user initialize', metas);
            this.#ready = true;
        })
    }

    async ready(): Promise<void> {
        while(!this.#ready){
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    forceReady(){
        this.#ready = true;
    }

    get events(): IEvent[] {
        const events: IEvent[] = [];
        if(this.#profile) events.push(this.#profile);
        if(this.#relays) events.push(this.#relays);
        return events;
    }

    get keys(): (keyof this)[] {
        return [
            'pubkey',
            'name',
            'about',
            'lud06',
            'lud16',
            'lnaddr',
            'photo',
            'banner',
            'relays',
            'reference'
        ]
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

    get about(): string | undefined {
        return this.#profile?.about;
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

    set relays(instance: PubkeyRelays){
        this.#relays = instance;
    }

    set profile(instance: PubkeyProfile){
        this.#profile = instance;
    }

    get reference(): string | undefined {
        const pointer: nip19.ProfilePointer = {
            pubkey: this.#pubkey,
            relays: this.relays
        }
        return nip19.nprofileEncode(pointer)
    }
}