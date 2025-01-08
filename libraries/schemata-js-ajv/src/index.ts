import { Ajv, type ErrorObject } from 'ajv';
import * as NostrSchemata from '@nostrwatch/schemata'
import { type NostrEvent } from 'nostr-tools'

const ajv = new Ajv();

type NostrSchemataType = typeof NostrSchemata;

const defaultResult: SchemaValidatorResult = { valid: false, errors: [], warnings: [] }

export type SchemaValidatorResult = {
    valid: boolean;
    warnings: string[];
    errors: ErrorObject[];
}

const validate = (schema: any, data: any): SchemaValidatorResult => {
    const result = structuredClone(defaultResult)
    const validate = ajv.compile(schema);
    const valid = validate(data);
    if(valid) {
        result.valid = true;
        return result;
    }
    result.errors = validate.errors ?? [];
    return result;
}

export const validateNote = (note: NostrEvent): SchemaValidatorResult | undefined  => {
    const { kind } = note;
    const schema = NostrSchemata?.[`kind${kind}Schema` as keyof NostrSchemataType];
    if(!schema) {
        const result = structuredClone(defaultResult);
        result.warnings.push(`No schema found for kind ${kind}`);
        return result;
    }
    return validate(schema, note);
}

export const validateMessage = (message: any, subject: 'relay' | 'client', slug: string): SchemaValidatorResult | undefined => {
    const result: SchemaValidatorResult = { valid: false, errors: [], warnings: [] }
    const key = formatMessageSignature(subject, slug);
    const schema = NostrSchemata?.[key as keyof NostrSchemataType];
    if(!schema) {
        result.warnings.push(`No schema found for ${subject} ${slug}`);
        return result;
    }
    return validate(schema, message);
}

export const validateNip11 = (nip11: any): SchemaValidatorResult | undefined => {
    const { nip11Schema } = NostrSchemata;
    return validate(nip11Schema, nip11);
};

const formatMessageSignature = (subject: 'relay' | 'client', slug: string): string => {
    slug = slug.toLowerCase();
    return `${subject}${capitalize(slug)}Schema`
}

export const capitalize = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};  