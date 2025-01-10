import { Service, type FetchOptions } from "@nostrwatch/nip66/services"
import type { Filter } from "nostr-tools";
import type { WebsocketAdapterOptions, WebsocketRequestBody } from "@nostrwatch/nip66/core";
import { DataTablePreset } from "src/lib/models/Preset";
import type { IEvent } from "@nostrwatch/nip66/models";
import type { IAdaptersArgument } from "@nostrwatch/nip66";

export type PresetGenerator = AsyncGenerator<DataTablePreset[], void, unknown>;

export class PresetService extends Service {
    constructor(adapters: IAdaptersArgument){
        super(adapters);
        this.addRelay('appData', 'wss://appdata.kindpag.es')
    }
    
    async *subscribeAllPresets(): PresetGenerator {
        const filters: Filter[] = [ this.filter() ] 
        yield *this.subscribePresets(filters)
    }

    async *subscribeUserPresets(pubkey: string): PresetGenerator {
        const filters: Filter[] = [ this.filter({ authors: [pubkey] }) ] 
        yield *this.subscribePresets(filters)
    }

    async publishPreset(preset: DataTablePreset){
        this.publish()
    }

    async *subscribePresetsByTags(topics: string[]): PresetGenerator {
        const filters: Filter[] = [ this.filter({ "#t": topics }) ] 
        yield *this.subscribePresets(filters)
    }
    
    private async *subscribePresets(filters: Filter[], relays?: string[]): PresetGenerator {
        relays = relays || [];
        const priority = 100;
        
        const options: WebsocketAdapterOptions = {
            cache: true,
            stream: true,
            returnResults: false,
            keepAlive: false,
            batch: 10
        };
        const args: WebsocketRequestBody = {
            filters,
            relays,
            options,
            priority
        };

        const eventQueue: IEvent[][] = [];
        let resolveQueue: (() => void) | null = null;
    
        const generator = async function* () {
            while (true) {
                if (eventQueue.length > 0) {
                    const notes = eventQueue.shift()!;
                    const presets: (DataTablePreset | undefined)[] = 
                        notes.map( (note: IEvent) => {
                            try {
                                return JSON.parse(note.content) as DataTablePreset;
                            }
                            catch(e){
                                console.error('failed to parse preset', e, note.content)
                            }
                        }) 
                        .filter( (preset: DataTablePreset | undefined) => preset !== undefined );
                    yield presets as DataTablePreset[];
                } else {
                    await new Promise<void>((resolve) => {
                        resolveQueue = resolve;
                    });
                }
            }
        };
    
        const onevents = (events: IEvent[]) => {
            eventQueue.push(events);
            if (resolveQueue) {
                resolveQueue();
                resolveQueue = null;
            }
        };
        this.subscribe(args as FetchOptions, { onevents })
        yield* generator();
    }

    private filter( filter: Filter = {} ) {
        return { ...filter, '#d': [DataTablePreset.address] }
    }
}