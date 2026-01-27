import { zapSumNum } from "$utils/nostr";
import { Service, type IAdaptersArgument } from "@nostrwatch/route66";
import type { SubscribeHandlers, WebsocketAdapterOptions, WebsocketRequestBody } from "@nostrwatch/route66/core/WebsocketAdapter";
import type { IEvent } from "@nostrwatch/route66/models";

type WikiEventProcessing = {
    engagement?: number,
    parent: IEvent,
    relatives: {
        zaps: IEvent[],
        comments: IEvent[],
        reactions: IEvent[]
    }
}

type WikiSorter = (a: WikiEventProcessing, b: WikiEventProcessing) => number

const emptyWikiEventProcessing: WikiEventProcessing = {
    engagement: 0,
    parent: {} as IEvent,
    relatives: {
        zaps: [],
        comments: [],
        reactions: []
    }
}

export class WikiService extends Service {

    private readonly KIND_WIKI = 30818;
    private processing: Map<string, WikiEventProcessing[]> = new Map();

    private _relays = [
        'wss://wikifreedia.xyz'
    ];

    constructor(adapters: IAdaptersArgument) {
        super(adapters);
    }

    set relays( relays: string[] ) {
        this._relays = relays;
    }

    get relays(): string[] {
        return this._relays;
    }

    addRelay( relay: string ) {
        this.relays.push(relay);
    }

    async fetchWikisAndSort( reference: string, callbacks?: SubscribeHandlers, sorter?: WikiSorter  ): Promise<WikiEventProcessing[]> {
        const filters = [{ 
            "#d": [reference], 
            kinds: [this.KIND_WIKI],
            limit: 5
        }];
        const options: WebsocketAdapterOptions = {
            keepAlive: false,
            stream: true,
            returnResults: true,
            cache: true,
            batch: 2
        };
        const args: WebsocketRequestBody = {
            relays: this.relays,
            options,
            filters
        };
        const onevents = async (events: IEvent[]) => {
            callbacks?.onevents?.(events)
            events.forEach((event: IEvent) => this.process(reference, event))
        }
        await this.subscribe( args, { ...callbacks, onevents } );
        this.postProcess(reference)
        return this.processing.get(reference)?.sort(sorter ?? this.sort) || [];
    }

    async process(reference: string, note: IEvent) {
        const processor: WikiEventProcessing = { ...structuredClone(emptyWikiEventProcessing), parent: note }
        const reactionPubkeys: Set<string> = new Set();
        const commentPubkeys: Set<string> = new Set();
        const onevents = async (relatives: IEvent[]) => {
            relatives.forEach((relative: IEvent) => {
                if(relative.pubkey === note.pubkey) return;
                if( [9735].includes(relative.kind) ) {
                    processor.relatives.zaps.push(relative);
                }
                else if( [1, 1111].includes(relative.kind) ) {
                    if(commentPubkeys.has(relative.pubkey)) return;
                    processor.relatives.comments.push(relative);
                    commentPubkeys.add(relative.pubkey);
                }
                else if( [7].includes(relative.kind) ) {
                    if(reactionPubkeys.has(relative.pubkey)) return;
                    processor.relatives.reactions.push(relative);
                    reactionPubkeys.add(relative.pubkey);
                }
            });
        }
        await this.getWikiRelatives(note, { onevents });
        const arr = this.processing.get(reference) || [];
        arr.push(processor);
        this.processing.set(reference, arr);
    }

    postProcess(reference: string) {
        const zapWeight = 5;
        const commentWeight = 2;
        const reactionWeight = 1;

        let events = structuredClone(this.processing.get(reference));

        let maxEngagement = 0;

        if(!events?.length) return;

        events.forEach((processor: WikiEventProcessing) => {
            let zapsSum = processor.relatives.zaps.length > 0 ? zapSumNum(wikiEvent.relatives.zaps) : 0;
            let commentsCount = processor.relatives.comments.length;
            let reactionsCount = processor.relatives.reactions.length;
            let engagementValue = (zapWeight * zapsSum) + (commentWeight * commentsCount) + (reactionWeight * reactionsCount);
            if (engagementValue > maxEngagement) {
                maxEngagement = engagementValue;
            }
        });

        events = events.map((processor: WikiEventProcessing, key: number) => {
            let zapsSum = zapSumNum(processor.relatives.zaps);
            let commentsCount = processor.relatives.comments.length;
            let reactionsCount = processor.relatives.reactions.length;
            let rawEngagement = (zapWeight * zapsSum) + (commentWeight * commentsCount) + (reactionWeight * reactionsCount);
            processor.engagement = maxEngagement > 0 ? rawEngagement / maxEngagement : 0;
            return processor;
        });

        this.processing.set(reference, events);
    }

    sort(a: WikiEventProcessing, b: WikiEventProcessing): number {
        return a.engagement && b.engagement ? b.engagement - a.engagement : 0;
    }

    private async getWikiRelatives( note: IEvent, callbacks?: SubscribeHandlers ) {
        return this.subscribeRelatives(note, this.relays, callbacks);
    }
}