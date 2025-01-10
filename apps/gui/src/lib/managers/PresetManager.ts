import { get } from "svelte/store";

import { StateManager } from "@nostrwatch/nip66";
import { Nip66 } from "@nostrwatch/nip66"
import { nip66 } from '$lib/stores';

import { PresetService } from "../services/PresetService";
import type { DataTablePreset, DataTablePresetConfig } from "../models/Preset";

export type DataTablePresetStorageKey = `preset:datatable:${string}`;

export class DataTablePresetManager {

    private _key: string;
    private _currentPreset?: DataTablePreset;
    private _service?: PresetService;
    
    constructor(key: string){
        this._key = key;
        const $nip66: Nip66 = get(nip66);
        $nip66.ready().then( this.initializeService.bind(this) )
    }

    initializeService( $nip66: Nip66 ){
        this._service = new PresetService($nip66.adapters);
    }

    loadPersistedPreset(){
        this._currentPreset = StateManager.get(this.key);
    }

    load(preset: DataTablePreset){
        this._currentPreset = preset;
    }

    save(preset: DataTablePreset){
        StateManager.set(this.key, preset);
    }

    async publish(preset: DataTablePreset){
        await this.service?.publishPreset(preset);   
    }

    get service(): PresetService | undefined {
        return this._service;
    }

    get key(): DataTablePresetStorageKey {
        return `preset:datatable:${this._key}`;
    }

    get currentPreset(){
        return this._currentPreset;
    }
    
}