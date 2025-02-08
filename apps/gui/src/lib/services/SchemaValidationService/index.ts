import { deterministicHash } from '@nostrwatch/route66/utils';
import type { NostrEvent } from 'nostr-tools';
import { get } from 'svelte/store';
import { EventEmitter } from 'tseep' 

export type SchemaValidationServiceRequest = {
    type: 'nip11' | 'message' | 'note',
    json: string,
    subject?: string,
    slug?: string,
    hash?: string
}

export type SchemaValidationServiceResponse = {
    status: 'success' | 'error',
    result: string,
    hash: string;
    error?: any
}

export class SchemaValidationService {
    worker: Worker;
    private _subIds: Set<string> = new Set();
    private emitter = new EventEmitter();

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
        return new Promise((resolve, reject) => {
            const timeout = setTimeout( () => reject({ status: 'error', hash, error: 'Request timed out, worker may have been terminated.' }), 5000)
            this.emitter.once(this.emitterKey(hash), (response: SchemaValidationServiceResponse) => {
                clearTimeout(timeout)
                const { error } = response;
                if(error) {
                    reject(response)
                }
                else {
                    resolve(response)
                }
            })
        })
    }

    private onmessage(message: MessageEvent<SchemaValidationServiceResponse>){
        const { hash } = message.data;
        this.emitter.emit(this.emitterKey(hash), message.data)
    }

    async validate(request: SchemaValidationServiceRequest, hash?: string): Promise<SchemaValidationServiceResponse> {
        hash = hash ?? deterministicHash(request.json)
        this._subIds.add(hash)
        this.worker.postMessage(request)
        console.log(`SchemaValidationService: validate request sent for ${hash}`)        
        const result = await this.respond(hash)
        console.log(`SchemaValidationService: validate request received for ${hash}`, result)
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