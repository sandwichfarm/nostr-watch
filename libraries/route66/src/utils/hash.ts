/**
 * Determines the type of the given value.
 */
function getType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (value instanceof RegExp) return 'regexp';
    if (value instanceof Map) return 'map';
    if (value instanceof Set) return 'set';
    return typeof value;
}

/**
 * Serializes any JavaScript value into a deterministic string.
 * Ensures that object keys are sorted to maintain consistency.
 */
function deterministicStringify(value: any): string {
    const seen = new WeakSet();

    function stringify(val: any): string {
        const type = getType(val);

        switch (type) {
            case 'undefined':
                return 'undefined';
            case 'null':
                return 'null';
            case 'boolean':
            case 'number':
            case 'bigint':
            case 'symbol':
                return val.toString();
            case 'string':
                return JSON.stringify(val);
            case 'date':
                return `Date:${val.toISOString()}`;
            case 'regexp':
                return `RegExp:${val.toString()}`;
            case 'function':
                return `Function:${val.toString()}`;
            case 'array':
                return `[${val.map((item: any) => stringify(item)).join(',')}]`;
            case 'map': {
                const mapEntries = Array.from(val.entries() as Iterable<[string, number]>).sort(([a], [b]) => {
                    if (a < b) return -1;
                    if (a > b) return 1;
                    return 0;
                });
            
                return `Map:{${mapEntries.map(([k, v]) => `${stringify(k)}=>${stringify(v)}`).join(',')}}`;
            }                     
            case 'set':
                const setEntries = Array.from(val.values()).sort();
                return `Set:{${setEntries.map(item => stringify(item)).join(',')}}`;
            case 'object':
                if (seen.has(val)) {
                    throw new TypeError('Converting circular structure to string');
                }
                seen.add(val);
                const keys = Object.keys(val).sort();
                const objString = `{${keys.map(key => `${JSON.stringify(key)}:${stringify(val[key])}`).join(',')}}`;
                seen.delete(val);
                return objString;
            default:
                return '';
        }
    }

    return stringify(value);
}

/**
 * Implements the FNV-1a hash algorithm.
 * Returns a hexadecimal string representation of the hash.
 */
function fnv1aHash(str: string): string {
    let hash = 0x811c9dc5; // FNV offset basis
    const prime = 0x01000193; // FNV prime

    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = (hash * prime) >>> 0;
    }

    // Convert to hexadecimal and pad with zeros if necessary
    return ('0000000' + hash.toString(16)).slice(-8);
}

/**
 * Generates a deterministic hash for any given input.
 * @param value The input value to hash.
 * @returns A hexadecimal string representing the hash.
 */
export function deterministicHash(value: any): string {
    const serialized = deterministicStringify(value);
    return fnv1aHash(serialized);
}
