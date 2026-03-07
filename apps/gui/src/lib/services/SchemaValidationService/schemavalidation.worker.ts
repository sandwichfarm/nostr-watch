import { deterministicHash } from '@nostrwatch/route66/utils';
import { validateNip11, validateMessage, validateNote, type SchemaValidatorResult } from '@nostrwatch/schemata-js-ajv'

self.onmessage = ({ data }) => {
    const { json, type, subject, slug } = data as any;
    let { hash } = data as any;
    if(!hash) {
        hash = deterministicHash(json)
    }
    try {
        let result: SchemaValidatorResult | undefined;
        let error: string = '';
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
        else {
            self.postMessage({
                status: 'error',
                hash,
                error: error || `Validation returned no result for type "${type}"`
            })
        }
    } catch (e: any) {
        self.postMessage({
            status: 'error',
            hash,
            error: e?.message || String(e)
        })
    }
}
