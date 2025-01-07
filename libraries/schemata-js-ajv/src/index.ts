import Ajv, { type ErrorObject } from 'ajv';
import * as NostrSchemata from '@nostrwatch/schemata'
import { type NostrEvent } from 'nostr-tools'

const ajv = new Ajv();

export type ValidatorResult = {
    valid: boolean;
    warnings: string[];
    errors: ErrorObject[];
}

export const validate = (note: NostrEvent): ValidatorResult | undefined  => {
    const { kind } = note;
    const result: ValidatorResult = { valid: false, errors: [], warnings: [] }
    const schema = NostrSchemata?.[`kind${kind}Schema`];
    if(!schema) {
        result.warnings.push('No schema found for kind');
        return result;
    }
    const validate = ajv.compile(schema);
    const valid = validate(note);
    if(valid) {
        result.valid = true;
        return result;
    }
    result.errors = validate.errors ?? [];
    return result;
}