import { Ajv, type ErrorObject } from 'ajv';
import ajvErrors from 'ajv-errors';

import * as NostrSchemata from '@nostrwatch/schemata'
import { type NostrEvent } from 'nostr-tools'

type NostrSchemataType = typeof NostrSchemata;

export type SchemaValidatorResult = {
    valid: boolean;
    warnings: ErrorObject[];
    errors: ErrorObject[];
}

const defaultResult: SchemaValidatorResult = { valid: false, errors: [], warnings: [] }

const collectAdditionalProps = (schema: any, data: any, path = ''): ErrorObject[] => {
    if (!schema || !data || typeof data !== 'object' || Array.isArray(data)) {
        return [];
    }

    const warnings: ErrorObject[] = [];
    
    if (schema.type === 'object') {
        if (schema.additionalProperties === false) {
            return [];
        }
        
        const allowedProps = new Set<string>();
        
        if (schema.properties) {
            Object.keys(schema.properties).forEach(prop => allowedProps.add(prop));
        }
        
        if (schema.patternProperties) {
            Object.keys(schema.patternProperties).forEach(pattern => {
                const regex = new RegExp(pattern);
                Object.keys(data).forEach(key => {
                    if (regex.test(key)) {
                        allowedProps.add(key);
                    }
                });
            });
        }
        
        Object.keys(data).forEach(key => {
            if (!allowedProps.has(key)) {
                warnings.push({
                    instancePath: path,
                    keyword: 'additionalProperties',
                    message: `additional property "${key}" exists`,
                    params: { additionalProperty: key },
                    schemaPath: ''
                } as ErrorObject);
            }
        });
        
        if (schema.properties) {
            Object.keys(schema.properties).forEach(prop => {
                if (data[prop] && typeof data[prop] === 'object') {
                    warnings.push(
                        ...collectAdditionalProps(
                            schema.properties[prop], 
                            data[prop], 
                            `${path}/${prop}`
                        )
                    );
                }
            });
        }
    }
    
    if (schema.type === 'array' && Array.isArray(data) && schema.items) {
        data.forEach((item, index) => {
            if (typeof item === 'object') {
                warnings.push(
                    ...collectAdditionalProps(
                        schema.items, 
                        item, 
                        `${path}/${index}`
                    )
                );
            }
        });
    }
    
    return warnings;
};

const validate = (schema: any, data: any): SchemaValidatorResult => {
    const ajv = new Ajv({
        strict: false, 
        allErrors: true
    });
    ajvErrors(ajv);
    const result = structuredClone(defaultResult);
    const validate = ajv.compile(schema);
    const valid = validate(data);
    
    if(valid) {
        result.valid = true;
        result.warnings = collectAdditionalProps(schema, data);
        return result;
    }
    
    result.errors = validate.errors ?? [];
    result.warnings = collectAdditionalProps(schema, data);
    
    return result;
}

// Export validate for testing
export { validate };

export const validateNote = (note: NostrEvent): SchemaValidatorResult | undefined  => {
    const { kind } = note;
    const schema = NostrSchemata?.[`kind${kind}Schema` as keyof NostrSchemataType];
    if(!schema) {
        const result = structuredClone(defaultResult);
        result.warnings.push({
            instancePath: '',
            keyword: 'note',
            message: `No schema found for kind ${kind}`,
            params: {},
            schemaPath: ''
        } as ErrorObject);
        return result;
    }
    return validate(schema, note);
}

export const validateMessage = (message: any, subject: 'relay' | 'client', slug: string): SchemaValidatorResult | undefined => {
    const result: SchemaValidatorResult = { valid: false, errors: [], warnings: [] }
    const key = formatMessageSignature(subject, slug);
    const schema = NostrSchemata?.[key as keyof NostrSchemataType];
    if(!schema) {
        result.warnings.push({
            instancePath: '',
            keyword: 'message',
            message: `No schema found for ${subject} ${slug}`,
            params: {},
            schemaPath: ''
        } as ErrorObject);
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