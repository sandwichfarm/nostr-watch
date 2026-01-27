import WebSocket from 'modern-isomorphic-ws';
interface WebSocketEventMap {
    open: Event;
    close: CloseEvent;
    error: ErrorEvent;
    message: MessageEvent;
}
export interface IWebSocketWrapper {
    ws: WebSocket | undefined;
    relay: string;
    _ready: boolean;
    on<Key extends keyof WebSocketEventMap>(key: Key, fn: (event: WebSocketEventMap[Key]) => void): void;
    off(): void;
    connect(): Promise<boolean>;
    ready(): Promise<void>;
    closed(): Promise<void>;
    defaultHandlers(): void;
    terminate(): void;
    close(): void;
    send<T>(data: T | Buffer | string): void;
    get CONNECTED(): boolean;
    get CONNECTING(): boolean;
    get CLOSING(): boolean;
    get CLOSED(): boolean;
    get BUSY(): boolean;
    get OPEN(): boolean;
}
export declare class WebSocketWrapper implements IWebSocketWrapper {
    ws: WebSocket | undefined;
    relay: string;
    _ready: boolean;
    private options?;
    private listeners;
    constructor(relay: string, options?: WebSocket.ClientOptions);
    on<Key extends keyof WebSocketEventMap>(key: Key, fn: (event: WebSocketEventMap[Key]) => void): void;
    off(): void;
    connect(): Promise<boolean>;
    ready(): Promise<void>;
    closed(): Promise<void>;
    defaultHandlers(): void;
    terminate(): void;
    close(): void;
    send<T>(data: T | Buffer | string): void;
    get CONNECTED(): boolean;
    get CONNECTING(): boolean;
    get CLOSING(): boolean;
    get CLOSED(): boolean;
    get BUSY(): boolean;
    get OPEN(): boolean;
}
export {};
