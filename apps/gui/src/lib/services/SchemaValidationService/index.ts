import { deterministicHash } from '@nostrwatch/route66/utils';
import { EventEmitter } from 'tseep' 
import type { SchemaValidatorResult } from '@nostrwatch/schemata-js-ajv';

export type SchemaValidationServiceRequest = {
    type: 'nip11' | 'message' | 'note',
    json: any,
    subject?: string,
    slug?: string,
    hash?: string
}

export type SchemaValidationServiceResponse = {
    status: 'success' | 'error',
    result: SchemaValidatorResult,
    hash: string;
    error?: any
}

export class SchemaValidationService {
    worker: Worker;
    private _subIds: Set<string> = new Set();
    private emitter = new EventEmitter();
    private readonly defaultResult: SchemaValidatorResult = { valid: false, errors: [], warnings: [] };
    private errorResult(message?: unknown): SchemaValidatorResult {
        if (!message) return this.defaultResult;
        return {
            valid: false,
            warnings: [],
            errors: [{ message: String(message), instancePath: '', schemaPath: '' }] as any,
        };
    }

    constructor(){
        this.worker = new Worker(new URL('./schemavalidation.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = this.onmessage.bind(this);
    }

    get subIds(): Set<string> { 
        return this._subIds;
    }

    emitterKey(hash: string) {
        return `schemaValidation:${hash}`
    }

    async respond(hash: string): Promise<SchemaValidationServiceResponse> {
        return new Promise((resolve) => {
            const key = this.emitterKey(hash);
            const onResponse = (response: SchemaValidationServiceResponse) => {
                clearTimeout(timeout)
                resolve(response)
            };

            const timeout = setTimeout(
                () => {
                    this.emitter.off(key, onResponse)
                    resolve({
                        status: 'error',
                        hash,
                        result: this.errorResult('Request timed out, worker may have been terminated.'),
                        error: 'Request timed out, worker may have been terminated.',
                    })
                },
                5000
            );
            this.emitter.once(key, onResponse)
        })
    }

    private onmessage(message: MessageEvent<SchemaValidationServiceResponse>){
        const { hash, status, error } = message.data;
        const normalized: SchemaValidationServiceResponse =
            status === 'success'
                ? message.data
                : {
                      status: 'error',
                      hash,
                      result: this.errorResult(error),
                      error,
                  };
        this.emitter.emit(this.emitterKey(hash), normalized)
    }

    async validate(request: SchemaValidationServiceRequest, hash?: string): Promise<SchemaValidationServiceResponse> {
        hash = hash ?? deterministicHash(request.json)
        request.hash = hash
        this._subIds.add(hash)
        this.worker.postMessage(request)
        // console.log(`SchemaValidationService: validate request sent for ${hash}`)        
        const result = await this.respond(hash)
        // console.log(`SchemaValidationService: validate request received for ${hash}`, result)
        return result;
    }
    
    async validateNip11(nip11: any, hash?: string): Promise<SchemaValidationServiceResponse> {
        const request: SchemaValidationServiceRequest = { 
            type: 'nip11',
            json: nip11
        }
        return this.validate(request, hash)
    }

    async validateMessage(json: string, subject: string, slug: string): Promise<SchemaValidationServiceResponse> {
        const request: SchemaValidationServiceRequest = { 
            type: 'message',
            subject,
            slug,
            json
        }
        return this.validate(request)
    }

    async validateNote(json: any): Promise<SchemaValidationServiceResponse> {
        let hash: string | undefined;
        if(json?.id) {
            hash = json.id;
        }
        const request: SchemaValidationServiceRequest = { 
            type: 'note',
            json, 
            hash 
        }
        return this.validate(request, hash)
    }
}
