import { eventMatchesFilter, SvelteMemoryRelay } from "@nostrwatch/memory-relay";
import { Service, type IAdaptersArgument } from "@nostrwatch/route66";
import { type WebsocketRequestBody } from "@nostrwatch/route66/core";
import { NostrEvent, PubkeyRelays, type IEvent } from "@nostrwatch/route66/models";
import type { Filter } from "nostr-tools";
import { get, writable, type Writable } from "svelte/store";
import type { UserFetchArgs, UserWebsocketRequestBody } from "../UserService";
import type { SubscribeHandlers, WebsocketAdapterOptions, WebsocketRequestBody } from "@nostrwatch/route66/core/WebsocketAdapter";
import type { User } from "$lib/models/User";
import { eventsStoreMemoryRelay } from "$lib/stores/memory-relays/memory-relay-events";
import { pubkeyRelays, pubkeyUserInstance } from "$lib/stores/helpers/helpers-pubkey";
import { userService } from "$lib/stores/services";

export class FeedService extends Service {
    private readonly relativesKinds = [1, 7, 1111, 9735, 9321];

    private _relay: SvelteMemoryRelay<IEvent, NostrEvent> = new SvelteMemoryRelay<IEvent, NostrEvent>(writable(new Map()))
    private _filters: Filter[] = []
    private _relays: string[] = ['wss://relay.nostr.band', 'wss://relay.damus.io']
    private _acceptedKinds: number[] = []  
    private _fetches: number = 0; 

    private _highestTimestamp: number[] = Array(this._filters.length).fill(0);
    private _lowestTimestamp: number[] = Array(this._filters.length).fill(0);

    relativeFetchers: Map<string, () => void> = new Map()

    constructor(adapters: IAdaptersArgument, filters: Filter[] = [{}], relays: string[] = []){
        super(adapters)
        this._relays = [...this._relays, ...relays]
        this._filters = filters
        // console.log('filters', filters, this._filters, this.filters)
        this._relay.on('qualify', (event: IEvent) => {
            return true
        })

        this._relay.on('instantiate', (event: IEvent) => {
            // let user: User | undefined; 
            // user = pubkeyUserInstance(event.pubkey)
            // if(!user) {}
            return new NostrEvent(event)
        })

        this._ready = true;
    }

    get memoryRelay(): SvelteMemoryRelay<IEvent, NostrEvent> {  
        return this._relay
    }

    get store(): Writable<Map<string, NostrEvent>> {
        return this.memoryRelay.store
    }

    get relays(): string[] {
        return this._relays
    }

    get acceptedKinds(): number[] {
        return Array.from(new Set([...this.relativesKinds, ...this._acceptedKinds]))
    }

    get filters(): Filter[] {
        return this._filters
    }

    set filters(filters: Filter[]){
        this._filters = filters
    }

    get highestTimestamp(): number[] {
        return this._highestTimestamp
    }

    get lowestTimestamp(): number[] {
        return this._lowestTimestamp
    }

    since(index: number): number {
        return this._highestTimestamp?.[index] ?? 0
    }

    until(index: number): number {
        return this._lowestTimestamp?.[index] ?? 0
    }

    setTimestampRange(event: IEvent){
        for( const [ index, filter ] of this.filters.entries() ){
            if(eventMatchesFilter(event, filter)) {
                const { created_at } = event
                if(!created_at) continue
                if(!this.since(index) || created_at > this.since(index)) this._highestTimestamp[index] = created_at
                if(!this.until(index) || created_at < this.until(index)) this._lowestTimestamp[index] = created_at
                break;
            }
        }
    }

    addRelay(relay: string){
        this._relays.push(relay)
    }

    async detectUserRelays(user: User){
        if(user.relays) user.relays.forEach( this.addRelay.bind(this) )
    }

    async populate(){
        // console.log('populating feed', this.filters)
        this.populateAuthorsRelays()
        const options: WebsocketAdapterOptions = {
            cache: true,
            stream: true,
            returnResults: true,
            keepAlive: false,
            batch: 3
        };

        const args: WebsocketRequestBody = {
            filters: this.maybeModifyFilters(),
            relays: this._relays,
            options,
            priority: 10
        }

        const onevents = async (events: IEvent[]) => {
            // console.log('populating feed with events', events.length)
            this.memoryRelay.eventBatch(events)
            events.forEach(this.processNote.bind(this))
        }

        const onevent = console.log

        // console.log(`subscribing to feed #${this._fetches}`, args)
        this._fetches++;
         await this.subscribe(args, { onevents, onevent })
    }

    private processNote = async (event: IEvent) => {
        const note = this.memoryRelay.get(event.id)
        if(!note) return console.warn('Note not found, it should be found', event.id)
        let user = pubkeyUserInstance(note.pubkey)
        if(!user){
            user = get(userService)?.userFromPubkey(note.pubkey)
            if(!user) return;
            await user.ready();
            get(eventsStoreMemoryRelay).eventBatch( user.events )
        }
        if(!user) return;
        this.setTimestampRange(event)
        this.relativeFetchers.set(event.id, () => {
            // console.log('fetchRelatives', note.id)
            this.fetchRelatives(user, note)
        })
    }

    async fetchRelatives(user: User, note: NostrEvent){
        // console.log('fetchRelatives', note.id)
        const onevent = (events: IEvent) => this.memoryRelay.event(events)
        this.noteRelatives(user, note, { onevent })
    }

    private populateAuthorsRelays(){
        const authors: string[] = this.authorsFromFilters()
        // console.log('authors', authors)
        const authorsRelays: Set<string> = new Set()
        if(authors){
            authors.forEach((author) => {
                const relays = pubkeyRelays(author)?.relays ?? []
                // console.log(relays)
                relays.forEach(relay => authorsRelays.add(relay))
            })
        }
        this._relays = [...this.relays, ...Array.from(authorsRelays)]
    }

    private authorsFromFilters(): string[]{
        return Array.from(new Set( this.filters.map(filter => filter.authors).flat() )).filter( value => typeof value !== 'undefined');
    }

    private maybeModifyFilters(): Filter[] {
        if(this._fetches === 0) return this.filters
        return this.filters.map((filter, index) => {
            const until = this.until(index)
            if(!until) return filter
            return { ...structuredClone(filter), until }
        })
    }

    private async noteRelatives(user: User, note: NostrEvent, callbacks: SubscribeHandlers): Promise<IEvent[]> {
        const { id } = note
        const filters: Filter[] = [
            { kinds: [9735, 9321], '#e': [id] },  //zaps
            { kinds: [1, 7, 1111], '#e': [id] },  //commments, mentions
            { kinds: [1111], '#E': [id] }         //NIP-22 comments
        ]
        const relays: string[] = [ ...(user.relays || []), 'wss://relay.nostr.band', 'wss://relay.damus.io' ]
        const options: WebsocketAdapterOptions  = {
            cache: true,
            stream: true,
            returnResults: true,
            keepAlive: false
        }
        // const hash = `${note.id}-${user.pubkey}`
        const args: UserFetchArgs = {
            filters,
            relays,
            options,
            priority: 5
        }
        return this.subscribe(args, callbacks) as Promise<IEvent[]>
    }

    destroy(){
        this.memoryRelay.destroy()
    }
}