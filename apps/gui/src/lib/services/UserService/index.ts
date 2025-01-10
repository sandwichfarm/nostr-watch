import { Service, type FetchOptions } from "@nostrwatch/nip66/services"
import type { IAdaptersArgument } from "@nostrwatch/nip66/interfaces"
import { User } from "$lib/models/User.js"
import { NostrEvent, type IEvent } from "@nostrwatch/nip66/models"
import type { Pubkey } from "$lib/models/User.js";
import type {  WebsocketAdapterOptions, WebsocketRequestBody } from "@nostrwatch/nip66/core/WebsocketAdapter";
import type { Filter } from "nostr-tools";
import { get } from "svelte/store";
import { nip66 } from "$lib/stores";
import type Nip66 from "@nostrwatch/nip66"

export type UserFeedItem = {
    user: User,
    fetchRelatives: () => Promise<UserFeedItemRelatives>,
}

export type UserFeedItemRelatives = {
    reactions: IEvent[],
    zaps: IEvent[],
    comments: IEvent[]
}

export type UserFeed = UserFeedItem[]

export interface UserFetchOptions extends WebsocketAdapterOptions {}

export interface UserFetchArgs extends FetchOptions {
    filters: Filter[];
    relays: string[],
    options: UserFetchOptions,
    hash?: string,
    priority?: number
}

export class UserService extends Service {

    private _subIds: string[] = []

    constructor(adapters: IAdaptersArgument){
        super(adapters)
        this.addRelay('userMeta', 'wss://purplepag.es')
        this.addRelay('userMeta', 'wss://user.kindpag.es')
    }

    get subIds(): string[] {
        return this._subIds
    }

    private set subId(id: string) {
        this._subIds.push(id)
    }

    userFromPubkey(pubkey: Pubkey): User {
        return new User(pubkey, this);
    }

    async userNotes(user: User, limit: number = 30, until?: number): Promise<IEvent[]> {
        until = until || Math.round(Date.now() / 1000);
        const filter: Filter = { authors: [user.pubkey], kinds: [1], limit, until};
        const options: WebsocketAdapterOptions = {
            cache: false,
            stream: false,
            returnResults: true,
            keepAlive: false,
        };
        const args: UserFetchArgs = {
            filters: [filter],
            relays: user.relays || [],
            options,
            priority: 10
        };
        let notes = (await this.subscribe(args))?.sort((a, b) => (b.created_at as number) - (a.created_at as number));
        return notes;
    }

    async unsubscribe(hash?: string): Promise<void> {
        const $nip66: Nip66 = get(nip66)
        await $nip66.adapters?.websocket?.unsubscribe(hash)
    }

    async unsubscribeAll(): Promise<void> {
        const $nip66: Nip66 = get(nip66)
        const promises: Promise<boolean>[] = []
        for(const id of this._subIds) {
            promises.push($nip66.adapters?.websocket?.unsubscribe(id))
        }
        await Promise.all(promises)
        this._subIds = []
    }

    async feed(user: User, limit: number = 1, until?: number): Promise<UserFeedItem[]> {
        const { relays } = user
        const notes = await this.userNotes(user, limit, until)
        const relatives: IEvent[][] = [[]]
    
        return notes
            .map((_note: IEvent, index: number) => {
                const note = new NostrEvent(_note, { relays: relays ?? [] })
                const fetchRelatives = async (): Promise<UserFeedItemRelatives> => {
                    const fetcher = this.noteRelatives.bind(this)
                    const relatives = await fetcher(user, note)
                    const reactions = relatives.filter(rel => rel.kind === 7);
                    const zaps = relatives.filter(rel => rel.kind === 9735 || rel.kind === 9321);
                    const comments = relatives.filter(rel => rel.kind === 1 || rel.kind === 1111);
                    return { reactions, zaps, comments};
                }
                return { user, note, fetchRelatives };
            })
    }

    async noteRelatives(user: User, note: IEvent): Promise<IEvent[]> {
        const { id, pubkey } = note
        const filters: Filter[] = [
            { kinds: [9735, 9321], '#e': [id] }, //zaps
            { kinds: [1, 7, 1111], '#e': [id] }, //commments, mentions
            { kinds: [1111], '#E': [id] } //NIP-22 comments
        ]
        const relays: string[] = [ ...(user.relays || []), 'wss://relay.nostr.band', 'wss://relay.damus.io' ]
        const options: WebsocketAdapterOptions  = {
            cache: false,
            stream: true,
            returnResults: true,
            keepAlive: false
        }
        const hash = `${note.id}-${user.pubkey}`
        this.subId = hash
        const args: UserFetchArgs = {
            filters,
            relays,
            options,
            hash,
            priority: 5
        }
        return this.subscribe(args) as Promise<IEvent[]>
    }

    async meta(user: User): Promise<IEvent[] | boolean | undefined> {
        const filter: Filter = {authors: [user.pubkey], kinds: [0, 10002]}
        const options: WebsocketAdapterOptions  = {
            cache: false,
            stream: false,
            returnResults: true,
            keepAlive: false
        }
        const args: UserFetchArgs = {
            filters: [filter],
            relays: this.userMetaRelays,
            options
        }
        return this.subscribe(args)
    }

    async fetch(args: UserFetchArgs): Promise<IEvent[]> {
        return this._fetch(args);
    }

}

const isComment = ( ev: IEvent ): boolean => {
    return ev.tags.some( tag => tag[0] === 'e' || tag[0] === 'a' )
}

const isNotComment = ( ev: IEvent ): boolean => {
    return !isComment(ev)
}