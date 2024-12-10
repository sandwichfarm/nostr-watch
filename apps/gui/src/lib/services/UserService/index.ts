import { Service, type FetchOptions } from "@nostrwatch/nip66/services"
import type { IAdaptersArgument } from "@nostrwatch/nip66/interfaces"
import { User } from "$lib/models/User.js"
import { NostrEvent, type IEvent } from "@nostrwatch/nip66/models"
import type { Pubkey } from "$lib/models/User.js";
import type { SubscribeHandlers, WebsocketAdapterOptions, WebsocketRequestBody } from "@nostrwatch/nip66/core/WebsocketAdapter";
import type { Filter } from "nostr-tools";
import { events } from "$lib/stores";

export type UserFeedItem = {
    note: NostrEvent,
    reactions: IEvent[],
    zaps: IEvent[],
    comments: IEvent[]
}

export type UserFeed = UserFeedItem[]

export interface UserFetchOptions extends WebsocketAdapterOptions {}

export interface UserFetchArgs extends FetchOptions {
    filters: Filter[];
    relays: string[],
    options: UserFetchOptions
}

export class UserService extends Service {

    constructor(adapters: IAdaptersArgument){
        super(adapters)
        this.addRelay('userMeta', 'wss://purplepag.es')
        this.addRelay('userMeta', 'wss://user.kindpag.es')
    }

    userFromPubkey(pubkey: Pubkey): User {
        return new User(pubkey, this);
    }

    async userNotes(user: User, limit: number = 30, callbacks?: SubscribeHandlers): Promise<IEvent[]> {
        const until = Math.round(Date.now() / 1000);
        const filter: Filter = { authors: [user.pubkey], kinds: [1], limit, until};
        const options: WebsocketAdapterOptions = {
            cache: true,
            stream: false,
            returnResults: true,
            keepAlive: false
        };
        const args: UserFetchArgs = {
            filters: [filter],
            relays: user.relays || [],
            options
        };
        // const onevent = (event: IEvent) => {
        //     if(callbacks) callbacks?.onevent?.(event);
        // }
        let notes = (await this.subscribe(args))?.sort((a, b) => (b.created_at as number) - (a.created_at as number));
        // return notes.filter(isNotComment);
        return notes;
    }

    async feed(user: User, limit: number = 1): Promise<UserFeedItem[]> {
        const { relays } = user
        const notes = await this.userNotes(user, limit)
        const relatives = await Promise.all(notes.map((note: IEvent) => this.noteRelatives(user, note)));
    
        return notes
            .map((_note: IEvent, index: number) => {
                const note = new NostrEvent(_note, { relays: relays ?? [] })
                const relativesForNote = relatives[index] || [];
                const reactions = relativesForNote.filter(rel => rel.kind === 7);
                const zaps = relativesForNote.filter(rel => rel.kind === 9734 || rel.kind === 9321);
                const comments = relativesForNote.filter(rel => rel.kind === 1);
                return { note, reactions, zaps, comments };
            })
            .filter( (note: UserFeedItem | undefined) => typeof note !== 'undefined');
    }

    async noteRelatives(user: User, note: IEvent): Promise<IEvent[]> {
        const filters: Filter[] = [
            { kinds: [1, 7], '#e': [note.id], '#p': [user.pubkey] },
            { kinds: [9734, 9321], '#e': [note.id] }
        ]
        console.log('user note relatives', filters)
        const relays: string[] = [ ...(user.relays || []), 'wss://relay.nostr.band', 'wss://relay.damus.io' ]
        const options: WebsocketAdapterOptions  = {
            cache: false,
            stream: true,
            returnResults: true,
            keepAlive: false
        }
        const args: UserFetchArgs = {
            filters,
            relays,
            options
        }
        const results = this.subscribe(args)
        return results instanceof Array? results as IEvent[]: [];
    }

    async meta(user: User): Promise<IEvent[] | boolean | undefined> {
        console.log('user meta relays', user, this.userMetaRelays)
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
        console.log('user ffetch', args)
        return this._fetch(args);
    }

}

const isComment = ( ev: IEvent ): boolean => {
    return ev.tags.some( tag => tag[0] === 'e' || tag[0] === 'a' )
}

const isNotComment = ( ev: IEvent ): boolean => {
    return !isComment(ev)
}