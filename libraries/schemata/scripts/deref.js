/**
 * scripts/deref.js
 *
 * Usage: node deref.js input.json output.json
 * Actually merges references using @apidevtools/json-schema-ref-parser
 */

import fs from "fs/promises";
import path from "path";
import $RefParser from "@apidevtools/json-schema-ref-parser";

const [inputFile, outputFile] = process.argv.slice(2);

const stripNestedSchemaIds = (schema) => {
  if (!schema || typeof schema !== "object") return schema;

  const seen = new WeakSet();

  const visit = (value, depth) => {
    if (!value || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    if (!Array.isArray(value) && depth > 0 && typeof value.$id === "string") {
      delete value.$id;
    }

    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }

    for (const child of Object.values(value)) {
      visit(child, depth + 1);
    }
  };

  visit(schema, 0);
  return schema;
};

try {
  const data = await fs.readFile(path.resolve(inputFile), "utf-8");
  const schema = JSON.parse(data);

  const deref = await $RefParser.dereference(schema, {
  });

  stripNestedSchemaIds(deref);

  await fs.writeFile(path.resolve(outputFile), JSON.stringify(deref, null, 2), "utf-8");
  console.log(`Schema written to ${outputFile}`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
