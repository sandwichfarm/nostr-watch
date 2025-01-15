declare module 'json-source-map' {
    // Options for parsing JSON, allowing for custom behavior such as bigint support and jsonc (JSON with comments).
    export interface ParseOptions {
        bigint?: boolean; // Specifies if BigInt values should be parsed as native BigInt types.
        jsonc?: boolean; // Specifies if JSON with comments (jsonc) should be correctly parsed.
    }

    // Options for stringifying values into JSON, allowing for customization of the output.
    export interface StringifyOptions {
        space?: string | number; // Specifies the indentation for beautifying the output JSON.
        es6?: boolean; // Specifies if ES6 features (e.g., Set, Map) are allowed in the output.
    }

    // The result of parsing JSON, including the data and pointers to various elements within the JSON string.
    export interface ParseResult {
        data: any; // The parsed data as a JavaScript object.
        pointers: {
            [key: string]: {                
                value: { // The starting position of the value in the original JSON string.
                    line: number;
                    column: number;
                    pos: number;
                };
                valueEnd: { // The ending position of the value in the original JSON string.
                    line: number;
                    column: number;
                    pos: number;
                };
                key?: { // The starting position of the key in the original JSON string (for object properties).
                    line: number;
                    column: number;
                    pos: number;
                };
                keyEnd?: { // The ending position of the key in the original JSON string (for object properties).
                    line: number;
                    column: number;
                    pos: number;
                };
            };
        };
    }

    // The result of stringifying a JavaScript value into JSON, including the JSON string and pointers to elements.
    export interface StringifyResult {
        json: string; // The generated JSON string.
        pointers: {
            [key: string]: {
                value: { // The starting position of the value in the resulting JSON string.
                    line: number;
                    column: number;
                    pos: number;
                };
                valueEnd: { // The ending position of the value in the resulting JSON string.
                    line: number;
                    column: number;
                    pos: number;
                };
                key?: { // The starting position of the key in the resulting JSON string (for object properties).
                    line: number;
                    column: number;
                    pos: number;
                };
                keyEnd?: { // The ending position of the key in the resulting JSON string (for object properties).
                    line: number;
                    column: number;
                    pos: number;
                };
            };
        };
    }

    // Parses a JSON string into a JavaScript object, with options for handling BigInt and comments (jsonc).
    export function parse(json: string, _?: any, options?: ParseOptions): ParseResult;

    // Converts a JavaScript value to a JSON string, with options for output formatting and ES6 feature inclusion.
    export function stringify(value: any, _?: any, options?: string | number | StringifyOptions): StringifyResult;
}