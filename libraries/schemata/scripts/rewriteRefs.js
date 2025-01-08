/**
 * scripts/rewriteRefs.js
 *
 * Usage: node rewriteRefs.js input.json output.json
 *
 * This script:
 *   1) Reads "input.json" (a schema).
 *   2) Finds any "$ref" that starts with "nips/" or "@/".
 *   3) Replaces it with an absolute path pointing inside "dist/...".
 *   4) Writes the result back to "output.json".
 *
 * Because Makefile does `cd dist` before calling this, `process.cwd()` is the dist/ folder.
 */

import fs from "fs/promises";
import path from "path";

async function rewriteRefs(inputFile, outputFile) {
  const schemaStr = await fs.readFile(path.resolve(inputFile), "utf-8");
  const schema = JSON.parse(schemaStr);

  const distRoot = process.cwd(); 

  function transform(obj) {
    if (Array.isArray(obj)) {
      obj.forEach(transform);
    } else if (obj && typeof obj === "object") {
      for (const [key, val] of Object.entries(obj)) {
        if (key === "$ref" && typeof val === "string") {
          if (val.startsWith("@/")) {
            const absolute = path.join(distRoot, val);
            obj[key] = absolute;
          } else if (val.startsWith("nips/")) {
            const absolute = path.join(distRoot, val);
            obj[key] = absolute;
          }
        } else {
          transform(val);
        }
      }
    }
  }

  transform(schema);

  await fs.writeFile(
    path.resolve(outputFile),
    JSON.stringify(schema, null, 2),
    "utf-8"
  );
  console.log(`Rewrote references in ${outputFile}`);
}

const [inp, outp] = process.argv.slice(2);
rewriteRefs(inp, outp).catch(err => {
  console.error(err);
  process.exit(1);
});
