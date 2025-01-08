import { deterministicHash } from '@nostrwatch/nip66/utils/hash';
import { type SchemaValidatorResult } from '@nostrwatch/schemata-js-ajv'

self.onmessage = ({ data }) => {
    import('@nostrwatch/schemata-js-ajv').then( ({validateNip11, validateMessage, validateNote}) => {
        const { json, type, subject, slug } = data as any;
        let { hash } = data as any;
        let result: SchemaValidatorResult;
        let error: string = '';
        if(!hash) {
            hash = deterministicHash(json)
        }
        if(type === 'nip11') {
            result = validateNip11(json)
        }
        else if(type === 'message') {
            if(subject && slug) {
                result = validateMessage(json, subject, slug)
            }
            else {
                error = 'Both subject and slug are required for message validation (for example subject "relay" and slug "ok"'
            }
        }
        else if(type === 'note') {
            result = validateNote(json)
        }
        if(result) {
            self.postMessage({
                status: 'success',
                hash,
                result
            })
        }
        else if(error){
            self.postMessage({
                status: 'error',
                hash,
                error
            })
        }
    });
}