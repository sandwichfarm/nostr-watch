import WebSocket from 'modern-isomorphic-ws';
export class WebSocketWrapper {
    ws;
    relay;
    _ready = false;
    // private logger: Logger = new Logger('@nostrwatch/auditor:WebSocketWrapper');
    listeners = {};
    constructor(relay) {
        this.relay = relay;
    }
    on(key, fn) {
        // this.logger.debug(`binding ${key} event`);
        if (key === 'open' || key === 'close') {
            return console.warn(`Cannot override default ${key} event handler`);
        }
        const wrappedFn = (event) => {
            fn(event);
        };
        if (!this.listeners[key]) {
            this.listeners[key] = new Set();
        }
        this.listeners[key]?.add(wrappedFn);
        this.ws.addEventListener('message', wrappedFn);
    }
    off() {
        for (const [key, handlers] of Object.entries(this.listeners)) {
            const eventKey = key;
            handlers.forEach((fn) => {
                this.ws.removeEventListener('message', fn);
            });
        }
        this.listeners = {};
    }
    async connect() {
        const timeout = setTimeout(() => {
            if (this.CONNECTING) {
                // this.logger.debug('Connection timed out');
                this.terminate();
            }
        }, 10000);
        if (this.BUSY) {
            // this.logger.debug('Websocket is busy');
            await new Promise((resolve) => setTimeout(() => {
                // this.logger.debug('retrying connection');
                this.connect().then(resolve);
            }, 500));
            return false;
        }
        else if (this.CONNECTED) {
            return true;
        }
        this.ws = new WebSocket(this.relay);
        this.defaultHandlers();
        while (this.CONNECTING) {
            // this.logger.debug(`connecting to ${this.relay}`);
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        clearTimeout(timeout);
        if (this.CLOSED || this.CLOSING) {
            return false;
        }
        // this.logger.debug(`connected to ${this.relay}`);
        return true;
    }
    async ready() {
        while (!this._ready) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }
    async closed() {
        while (this.BUSY) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }
    defaultHandlers() {
        this.off();
        this.ws.addEventListener('open', () => (this._ready = true));
        this.ws.addEventListener('close', () => (this._ready = false));
        // this.ws.addEventListener('error', (err) => this.logger.debug(`error: ${err}`));
    }
    terminate() {
        if (typeof this.ws.terminate === 'function') {
            this.ws.terminate();
        }
        else {
            this.ws.close();
        }
    }
    close() {
        this.ws.close();
    }
    send(data) {
        console.log('WebsocketWrapper send', data);
        if (data instanceof Buffer) {
            this.ws.send(data.toString('utf-8'));
            console.log('WebsocketWrapper send', data.toString('utf-8'));
        }
        else if (data instanceof Object) {
            this.ws.send(JSON.stringify(data));
            console.log('WebsocketWrapper send', JSON.stringify(data));
        }
        else if (typeof data === 'string') {
            this.ws.send(data);
            console.log('WebsocketWrapper send', data);
        }
    }
    get CONNECTED() {
        return this.ws?.readyState === WebSocket.OPEN;
    }
    get CONNECTING() {
        return this.ws?.readyState === WebSocket.CONNECTING;
    }
    get CLOSING() {
        return this.ws?.readyState === WebSocket.CLOSING;
    }
    get CLOSED() {
        return this.ws?.readyState === WebSocket.CLOSED;
    }
    get BUSY() {
        return this.CONNECTING || this.CLOSING;
    }
}
//# sourceMappingURL=index.js.map