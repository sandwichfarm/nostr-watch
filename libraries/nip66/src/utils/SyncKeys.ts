export class SyncKeys {
    constructor(private pubkey: string) {}
    /**
     * Generates a key for a given kind and rangeKey.
     * @param kind The kind of event.
     * @param rangeKey The specific range ('since' | 'until' | etc.).
     * @returns The generated key as a string.
     */
    generateKey(key: string, kind: number, rangeKey: string): string {
      return `${this.pubkey}:${kind}:${key}:${rangeKey}`;
    }
}