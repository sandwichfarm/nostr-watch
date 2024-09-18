import parser from "@apidevtools/json-schema-ref-parser";
import fs from 'fs/promises';
import path from 'path';

const args = process.argv.slice(2);

const input = args[0];
const output = args[1];

try {
    const dereferencedSchema = await parser.dereference(input)
    await fs.writeFile(output, JSON.stringify(dereferencedSchema, null, 2), 'utf-8');

} catch (err) {
    console.error(`Error processing ${input}:`, err);
}
