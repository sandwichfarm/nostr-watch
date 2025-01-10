import { StateManager } from "@nostrwatch/nip66";
import type { DataTableConfig } from "../components/lists/table/DataTableTypes";
import { User } from "./User";
import { deterministicHash } from "@nostrwatch/nip66/utils";
import type { IEvent } from "@nostrwatch/nip66/models";

export type DataTablePresetConfig = {
    slug: string;
    description?: string;
    hash: string;
    pubkey?: string; 
    config: DataTableConfig;
}

export type DataTablePresetQuery = {
    hash?: string;
    pubkey?: string;
}

export class DataTablePreset {
    static prefix = 'urn:watch.nostr.preset';

    private _config: Partial<DataTableConfig>;
    private _slug: string; 
    private _description?: string;
    private _pubkey?: string; 
    private _user?: User;
    private _hash?: string;

    constructor(dataTablePresetConfig: Partial<DataTablePresetConfig>){
        const { config, slug, description, hash, pubkey } = dataTablePresetConfig;
        if(!config){
            throw new Error('dataTablePresetConfig must have a config property')
        }
        if(!slug){
            throw new Error('dataTablePresetConfig must have a slug property')
        }
        this._config = config;
        this._slug = slug;
        this._description = description ?? '';
        this._pubkey = pubkey;
        this._hash = deterministicHash(this.config);
        if(pubkey){
            this._user = new User(pubkey);
        }
    }

    get config(){
        return this._config;
    }

    get slug(){
        return this._slug;
    }

    get description(){
        return this._description;
    }

    get pubkey(){
        return this._pubkey;
    }

    get user(){
        return this._user;
    }

    get hash(){
        return this._hash;
    }

    get key(){
        return this.slug;
    }

    static address(resource: string){
        return `${DataTablePreset.prefix}:${resource}`;
    }

    note(pubkey: string): IEvent {
        return {
            kind: 30078,
            content: JSON.stringify(this.json),
            tags: [
                ['d', DataTablePreset.address(this.slug)],
                ['h', this.hash]
            ],
            created_at: Math.round(Date.now()/1000)
            
            // pubkey,
            // id,
            // signature,
        }
    }

    save(){
        StateManager.set(this.key, this.json);
    }

    get json(): Partial<DataTablePresetConfig> {
        let { slug, description, pubkey, config, hash } = this;
        if(!hash) {
            hash = deterministicHash(config);
        }
        return { slug, description, pubkey, config, hash }
    }
}


/* nip-78

custom/shared 
content 
    stringified: "{..DataTableConfig}"
tags 
    d: watch.nostr.preset
    slug: $SLUG
    hash: $HASH 
    version: 1   

defaults: 
    no event.
    source.
    config: DataTableConfig

notes
 - don't use d: identifiers in source, only for fetching. 
 - use ID comparison to detect changes. 

*/