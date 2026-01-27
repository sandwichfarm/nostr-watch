import { StateManager } from "@nostrwatch/route66";

type Primitive = string | number | boolean | undefined;
type PreferenceValue<T> = T | Preferences<T>;

export abstract class Preferences<T extends Record<string, any> = Record<string, any>> {
    private _data: Partial<{ [K in keyof T]: PreferenceValue<T[K]> }> = {};

    constructor(initialData?: Partial<T>) {
        if (initialData) {
            this.fromJson(initialData);
        }
    }

    /**
     * Sets a preference value. If the value is an instance of Preferences, it is stored accordingly.
     * @param key - The preference key.
     * @param value - The preference value.
     */
    set<K extends keyof T>(key: K, value: PreferenceValue<T[K]>): void {
        this._data[key] = value;
        StateManager.emit(`preferences.${String(key)}`, value);
        StateManager.emit(`preferences.change`, key, value);
    }

    /**
     * Gets a preference value.
     * @param key - The preference key.
     * @returns The preference value.
     */
    get<K extends keyof T>(key: K): PreferenceValue<T[K]> | undefined {
        return this._data[key];
    }

    /**
     * Adds a handler to be called when a preference value changes.
     * @param key - The preference key.
     * @param handler - The handler function.
     */
    subscribe<K extends keyof T>(key: K, handler: (value: PreferenceValue<T[K]>) => void): void {
        StateManager.on(`preferences.${String(key)}`, handler);
    }

    /**
     * Removes a handler from a preference value.
     * @param key - The preference key.
     * @param handler - The handler function.
     */
    unsubscribe<K extends keyof T>(key: K, handler?: (value: PreferenceValue<T[K]>) => void): void {
        StateManager.off(`preferences.${String(key)}`, handler);
    }

    /**
     * Watches for any change in the data
     */
    watch(handler: (data: Partial<T>) => void): void {
        StateManager.on('preferences.change', handler);
    }

    /**
     * Stops watching for any change in the data
     */
    unwatch(handler?: (data: Partial<T>) => void): void {
        StateManager.off('preferences.change', handler);
    }
    
    /**
     * Serializes the preferences to a JSON string.
     * Recursively serializes nested Preferences instances.
     * @returns JSON string representation of the preferences.
     */
    toJson(): string {
        const obj: Record<string, any> = {};
        for (const key in this._data) {
            if (this._data.hasOwnProperty(key)) {
                const value = this._data[key];
                if (value instanceof Preferences) {
                    obj[key] = JSON.parse(value.toJson());
                } else {
                    obj[key] = value;
                }
            }
        }
        return JSON.stringify(obj);
    }

    /**
     * Deserializes the preferences from a JSON object or string.
     * Recursively deserializes nested Preferences instances.
     * @param json - JSON string or object to deserialize from.
     */
    fromJson(json: string | Partial<T>): void {
        let data: Partial<T>;

        if (typeof json === 'string') {
            try {
                data = JSON.parse(json);
            } catch (e) {
                throw new Error("Invalid JSON string provided to fromJson.");
            }
        } else {
            data = json;
        }

        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                const value = data[key];
                if (this._isNestedPreferences(key, value)) {
                    const PrefClass = this.getPreferenceClass(key);
                    if (PrefClass) {
                        const prefInstance = new PrefClass(value);
                        this._data[key] = prefInstance;
                    } else {
                        console.warn(`No Preference class found for key: ${key}`);
                        this._data[key] = value as T[keyof T];
                    }
                } else {
                    this._data[key] = value as T[keyof T];
                }
            }
        }
    }

    /**
     * Determines if a key should be treated as a nested Preferences instance.
     * Override this method to customize behavior.
     * @param key - The preference key.
     * @param value - The preference value.
     * @returns Boolean indicating if the key is a nested Preferences.
     */
    protected _isNestedPreferences(key: string, value: any): boolean {
        // Implement logic to determine if a key should be treated as a nested Preferences.
        // For example, based on key naming conventions or value structure.
        // Here, we'll assume that if the value is an object and not an array, it's a nested Preferences.
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }

    /**
     * Retrieves the corresponding Preferences class for a given key.
     * Override this method to return appropriate classes based on the key.
     * @param key - The preference key.
     * @returns The Preferences subclass constructor or undefined.
     */
    protected getPreferenceClass<K extends keyof T>(key: K): PreferencesConstructor<T[K]> | undefined {
        const preferenceClasses: Record<string, PreferencesConstructor<any>> = {
        };
        return preferenceClasses[key as string];
    }
}

export type PreferencesConstructor<U extends Record<string, any>> = new (initialData?: Partial<U>) => Preferences<U>;