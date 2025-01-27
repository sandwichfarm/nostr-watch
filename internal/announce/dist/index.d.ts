interface AnnounceMonitorOptions {
    geo?: object;
    kinds?: number[];
    timeouts?: object;
    networks?: string[];
    checks?: string[];
    owner?: string;
    frequency?: string;
    relays?: string[];
    profile?: object;
}
export declare class AnnounceMonitor {
    events?: any;
    monReg?: any;
    monRelays: string[];
    monProfile: any;
    private publisher;
    private pubkey;
    constructor(options: AnnounceMonitorOptions, pubkey: string);
    setup(options: AnnounceMonitorOptions): void;
    static formatChecks(checks: Array<string>): Array<string>;
    generate(): any;
    sign(sk: Uint8Array): any;
    publish(): Promise<string[]>;
    static verify(ev: any): boolean;
}
export {};
