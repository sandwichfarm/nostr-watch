import { Preferences } from './Preferences';

export enum SyncModeEnum {
    Live = 'live',
    Auto = 'auto',
    Manual = 'manual'
}

export interface SyncSettingsInterface {
    mode: SyncModeEnum;
    on?: boolean;
    interval?: number;
}

export class SyncSettings extends Preferences<SyncSettingsInterface> {
    constructor(initialData?: Partial<SyncSettingsInterface>) {
        super(initialData);
    }
}