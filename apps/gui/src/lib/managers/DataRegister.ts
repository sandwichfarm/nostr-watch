import { StateManager } from '@nostrwatch/route66';
import { minimatch } from 'minimatch';
import timestring from 'timestring';

export type DataRegisterDataSet = {
    key: string;
    priority: number;
    fn: DataRegisterFn;
    condition?: DataRegisterCondition;
    onComplete?: DataRegisterFn;
    params?:  any[];
    expiry?: number | string;
}

export type DataRegisterComposite = {
    key: string;
    priority: number;
    keys: string[];
    condition?: DataRegisterCondition;
    onComplete?: DataRegisterFn;
    ignoreConditions?: Record<string, boolean>;
    ignoreExpiries?: Record<string, boolean>;
    expiry?: number | string;
}

export type DataRegisterExecutorArguments = {
    key: string;
    ignoreCondition?: boolean;
    ignoreExpiry?: boolean;
    params: any[];
}

export type DataRegisterState = {
    seeded: Map<string, boolean>;
}

export type DataRegisterFn = (...args: any[]) => Promise<void | any>
export type DataRegisterCondition = (state?: DataRegisterState) => Promise<boolean>

export class DataRegister {
    private abortController: AbortController | undefined;
    private abortSignal: AbortSignal | undefined;
    private allKeys = new Set<string>();
    private _seeded: Map<string, boolean> = new Map();
    private _dataSets: Map<string, DataRegisterDataSet> = new Map();
    private _composite: Map<string, DataRegisterComposite> = new Map();
    private _timestamps: Map<string, number> = new Map();
    private _busy: Map<string, boolean> = new Map();
    private _ready: boolean = false;

    get availableKeys(): string[] {
        return this.dataSetsArray.map((dataSet) => dataSet.key)
    }

    get dataSetsArray(): DataRegisterDataSet[] {
        return this.sortedDataSetsArray;
    }

    get state(): DataRegisterState {
        return { 
            seeded: structuredClone(this._seeded)
        }
    }

    set state(state: DataRegisterState) {
        this._seeded = state.seeded;
    }

    private get sortedDataSetsArray(): DataRegisterDataSet[] {
        return Array.from(this._dataSets.values()).sort((a, b) => a.priority - b.priority)
    }

    async ready(){
        while(!this._ready) {
            await new Promise(resolve => setTimeout(resolve, 200))
        }
    }

    unlock() {
        this._ready = true;
    }

    isComposite(dataSet: string): boolean {
        return this._composite.has(dataSet)? true: false;
    }

    exists(dataSet: string): boolean {
        return this.allKeys.has(dataSet)
    }

    localStorageSetTimestamp(key: string) {
        StateManager.set(`register:${key}`, this._timestamps.get(key))
    }

    localStorageLoadTimestamp(key: string){
        const fromCache = StateManager.get(`register:${key}`)
        console.log('localStorage', key, fromCache)
        if(!fromCache) return;
        this._timestamps.set(key, fromCache)
    }
    
    register(dataSet: DataRegisterDataSet) {
        const { key } = dataSet;
        if(this.exists(key)) return;
        if(typeof dataSet.expiry === 'string') {
            dataSet.expiry = timestring(dataSet.expiry, 'ms')
        }
        this._dataSets.set(key, dataSet)
        this._seeded.set(key, false)
        this.allKeys.add(key)
        this.localStorageLoadTimestamp(key)
    }

    composite(composite: DataRegisterComposite) {
        if(this.exists(composite.key)) {
            throw new Error(`Cannot composite, ${composite.key} already registered`)
        }
        this.validateRequest(composite.keys)
        if(typeof composite.expiry === 'string') {
            composite.expiry = timestring(composite.expiry, 'ms')
        }
        this._composite.set(composite.key, composite)
    }

    abort(){
        this.abortController = new AbortController();
        this.abortSignal = this.abortController.signal;
        this.abortController.abort();
    }

    private busy(key: string): boolean {
        return this._busy.get(key) || false;
    }

    async require(dataSets: string[], _params: Record<string, any[]> = {}): Promise<DataRegister> {
        this.abort()
        await this.ready();
        this.validateRequest(dataSets);
        this.execute(dataSets, _params)
    }

    private start(key: string) {
        this._busy.set(key, true)
    }

    private stop(key: string) {
        this._busy.set(key, false)
        this.updateTimestamp(key)
    }

    private updateTimestamp(key: string) {
        this._timestamps.set(key, Date.now())
        this.localStorageSetTimestamp(key)
    }

    private isExpired(key: string): boolean {
        console.log(`isExpired: ${key}`)
        
        const expiry = this._dataSets.get(key)?.expiry || this._composite.get(key)?.expiry;
        if(!expiry) {
            console.log(`isExpired: ${key} has no expiry (always expired)`)
            return true;
        }

        console.log(`isExpired: ${key} seeded`, this._seeded.get(key))
        const timestamp = this._timestamps.get(key);
        
        if(!timestamp) {
            console.log(`isExpired: ${key} has no timestamp (never been ran)`)
            return true;
        }

        const expired = Date.now() - timestamp > (expiry as number);
        console.log(`isExpired: cache has expired`, `${Date.now()} - ${timestamp} [${Date.now()-timestamp}]`, `>`,` ${expiry}`, 'evaluates as:', expired)
        
        return Date.now() - timestamp > (expiry as number);
    }

    private extractParams(key: string, _params: Record<string, any[]>): any[] {
        let params = _params[key];     
        if(params) return params;
        const pattern = Object.keys(_params).find(
            (p) => p !== '*' && minimatch(key, p)
        );
        if (pattern) {
            params = _params[pattern];
        }
        return params || _params['*'] || [];
    }

    private async execute(keys: string[], _params: Record<string, any> = []): Promise<DataRegister> {
        for (const key of keys) {
            if(this.busy(key)) continue;
            this.localStorageLoadTimestamp(key)
            if(!this.isExpired(key)) continue;
            this.start(key);
            const params = this.extractParams(key, _params);
            if (this.isComposite(key)) {
                await this.executeComposite({ key, params });
            } else {
                await this.executeFunction({ key, params });
            }
            this.stop(key);
        }
        return this;
    }

    private async executeFunction(args: DataRegisterExecutorArguments = { key: '', ignoreCondition: false, ignoreExpiry: false, params: [] }) {  
        console.log('execute', args)
        const { key, ignoreCondition, params } = args;
        const passesCondition = await this.testCondition(key, ignoreCondition);
        if(!passesCondition) return;
        const { fn, onComplete } = this._dataSets.get(key)!
        if( !fn || typeof fn !== 'function' ) return;
        let result = await fn(params)
        if(onComplete && typeof onComplete === 'function') {
            await onComplete(result)
        }
        this._seeded.set(key, true)
    }

    private async executeComposite(args: DataRegisterExecutorArguments = { key: '', ignoreCondition: false, params: [] }) {
        const { key: compositeKey, ignoreCondition: compositeIgnoreCondition, params } = args;
        const shouldRun = await this.testCondition(compositeKey, compositeIgnoreCondition, true);
        if (!shouldRun) return;
        const composite = this._composite.get(compositeKey)!;
        //
        const results = new Map()
        for (const key of composite.keys) {
            if (this.busy(key)) continue;
            this.start(key);
            if(!this.isExpired(key)) continue;
            const ignoreCondition = composite.ignoreConditions?.[key] ?? false;
            const ignoreExpiry = composite.ignoreExpiries?.[key] ?? false;
            const result = await this.executeFunction({ key, ignoreCondition, ignoreExpiry, params })
            this.stop(key)
            results.set(key, result)
        }
        if(composite.onComplete && typeof composite.onComplete === 'function') {
            await composite.onComplete(results)
        }
    }
    
    private async testCondition(dataSet: string, ignoreCondition: boolean = false, isComposite: boolean = false) {
        const condition = isComposite? 
            this._composite.get(dataSet)!.condition:
            this._dataSets.get(dataSet)!.condition;
        if(condition && typeof condition === 'function' && !ignoreCondition) {
            const shouldFetch = await condition(this.state)
            return !!shouldFetch
        }
        return true
    }

    private validateRequest(dataSets: string[]) {
        for(const dataSet of dataSets) {
            if(!this._dataSets.has(dataSet) && !this._composite.has(dataSet)) {
                throw new Error(`DataSet ${dataSet} not found`)
            }
        }
    }
}