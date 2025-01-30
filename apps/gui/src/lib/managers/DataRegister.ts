import { minimatch } from 'minimatch';

export type DataRegisterDataSet = {
    key: string;
    priority: number;
    fn: DataRegisterFn;
    condition?: DataRegisterCondition;
    params?:  any[];
}

export type DataRegisterComposite = {
    key: string;
    priority: number;
    keys: string[];
    condition?: DataRegisterCondition
    ignoreConditions?: Record<string, boolean>
}

export type DataRegisterExecutorArguments = {
    key: string;
    ignoreCondition?: boolean;
    params: any[];
}

export type DataRegisterState = {
    seeded: Map<string, boolean>;
}

export type DataRegisterFn = (...args: any[]) => Promise<void | any>
export type DataRegisterCondition = (state?: DataRegisterState) => Promise<boolean>

export class DataRegister {
    private allKeys = new Set<string>();
    private _seeded: Map<string, boolean> = new Map();
    private _dataSets: Map<string, DataRegisterDataSet> = new Map();
    private _composite: Map<string, DataRegisterComposite> = new Map();

    get availableKeys(): string[] {
        return this.dataSetsArray.map((dataSet) => dataSet.key)
    }

    get dataSetsArray(): DataRegisterDataSet[] {
        return this.sortedDataSetsArray;
    }

    get state(): DataRegisterState {
        return { 
            seeded: this._seeded 
        }
    }

    private get sortedDataSetsArray(): DataRegisterDataSet[] {
        return Array.from(this._dataSets.values()).sort((a, b) => a.priority - b.priority)
    }

    isComposite(dataSet: string): boolean {
        return this._composite.has(dataSet)? true: false;
    }

    exists(dataSet: string): boolean {
        return this.allKeys.has(dataSet)
    }
    
    register(dataSet: DataRegisterDataSet) {
        if(this.exists(dataSet.key)) {
            throw new Error(`DataSet ${dataSet.key} already registered`)
        }
        this._dataSets.set(dataSet.key, dataSet)
        this._seeded.set(dataSet.key, false)
        this.allKeys.add(dataSet.key)
    }

    composite(composite: DataRegisterComposite) {
        if(this.exists(composite.key)) {
            throw new Error(`Cannot composite, ${composite.key} already registered`)
        }
        this.validateRequest(composite.keys)
        this._composite.set(composite.key, composite)
    }

    async require(dataSets: string[], _params: Record<string, any[]> = {}) {
        this.validateRequest(dataSets);
        for (const key of dataSets) {
            const params = this.extractParams(key, _params);
            if (this.isComposite(key)) {
                await this.executeComposite({ key, params });
            } else {
                await this.execute({ key, params });
            }
        }
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

    private async execute(args: DataRegisterExecutorArguments = { key: '', ignoreCondition: false, params: [] }) {  
        const { key, ignoreCondition, params } = args;
        if(!this.testCondition(key, ignoreCondition)) return;
        const { fn } = this._dataSets.get(key)!
        if( !fn || typeof fn !== 'function' ) return;
        await fn(params)
    }

    private async executeComposite(args: DataRegisterExecutorArguments = { key: '', ignoreCondition: false, params: [] }) {
        const { key: compositeKey, ignoreCondition: compositeIgnoreCondition, params } = args;
        const shouldRun = await this.testCondition(compositeKey, compositeIgnoreCondition, true);
        if (!shouldRun) return;
        const composite = this._composite.get(compositeKey)!;
        for (const dataSetKey of composite.keys) {
            const ignore = composite.ignoreConditions?.[dataSetKey] ?? false;
            await this.execute({ key: dataSetKey, ignoreCondition: ignore, params })
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
    }

    private validateRequest(dataSets: string[]) {
        for(const dataSet of dataSets) {
            if(!this._dataSets.has(dataSet) && !this._composite.has(dataSet)) {
                throw new Error(`DataSet ${dataSet} not found`)
            }
        }
    }
}