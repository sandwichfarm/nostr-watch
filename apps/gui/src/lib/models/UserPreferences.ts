import { Preferences, PreferencesConstructor } from './Preferences';
import { SyncSettings } from './SyncSettings';
import { TableSettings } from './TableSettings';
import type { UserSettings } from './UserSettings';

export class UserPreferences extends Preferences<UserSettings> {
    protected nestedKeys: string[] = ['syncing', 'relaysTable', 'monitorsTable'];

    constructor(initialData?: Partial<UserSettings>) {
        super(initialData);
    }

    protected getPreferenceClass<K extends keyof UserSettings>(key: K): PreferencesConstructor<UserSettings[K]> | undefined {
        const classes: Record<string, PreferencesConstructor<any>> = {
            'syncing': SyncSettings,
            'relaysTable': TableSettings,
            'monitorsTable': TableSettings,
        };
        return classes[key as string];
    }
}
