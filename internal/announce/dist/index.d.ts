interface AnnounceMonitorOptions {
    geo?: object;
    kinds?: number[];
    timeouts?: object;
    networks?: string[];
    checks?: string[];
    owner?: string;
    frequency?: string;
    profile?: object;
    clientTag?: string;
    relays?: string[];
    userDataRelays?: string[];
}
export declare class AnnounceMonitor {
    events?: any;
    monReg?: any;
    monRelays: string[];
    userDataRelays: string[];
    monProfile: any;
    private nip66Publisher;
    private userMetaPublisher;
    private pubkey;
    private clientTag?;
    constructor(pubkey: string, options: AnnounceMonitorOptions);
    setup(options: AnnounceMonitorOptions): void;
    static formatChecks(checks: Array<string>): Array<string>;
    generate(): any;
    sign(sk: string): Promise<any>;
    publish(): Promise<string[]>;
    static verify(ev: any): boolean;
}
export {};
