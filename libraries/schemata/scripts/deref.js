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

try {
  const data = await fs.readFile(path.resolve(inputFile), "utf-8");
  const schema = JSON.parse(data);

  const deref = await $RefParser.dereference(schema, {
  });

  await fs.writeFile(path.resolve(outputFile), JSON.stringify(deref, null, 2), "utf-8");
  console.log(`Schema written to ${outputFile}`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
