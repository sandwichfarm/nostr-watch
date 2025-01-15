import { deterministicHash } from '@nostrwatch/nip66/utils';
import { validateNip11, validateMessage, validateNote, type SchemaValidatorResult } from '@nostrwatch/schemata-js-ajv'

self.onmessage = ({ data }) => {
    //console.log('schema validation worker recieved data', data)
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
            error = 'Both subject and slug are required for message validation (for example subject as "relay" and slug as "ok" for the NIP-01 "OK" message.)'
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
}