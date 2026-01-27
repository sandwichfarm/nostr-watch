/**
 * build.js
 *
 * 1) Finds all .json in dist/@ and dist/nips.
 * 2) Builds named exports in dist/bundle/schemas.js with custom logic:
 *    - If parent (or grandparent) is "tag":
 *        * File named "_A" => "ATagSchema", "_P" => "PTagSchema", etc.
 *        * Single letter like "a" => "aTagSchema"
 *        * "schema.json" in "tag/" => "tagSchema"
 *    - If file is dist/@/note.json => "noteSchema", etc.
 *    - If file base is "schema" => skip it, to avoid "SchemaSchema".
 *    - If file base starts with "schema." => remove "schema." => uppercase first letter of remainder.
 *    - Remove invalid chars (like @, -).
 * 3) Outputs dist/bundle/schemas.js + .d.ts, runs esbuild => dist/bundle/schemas.bundle.js
 */

import esbuild from 'esbuild';
import {
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
  existsSync
} from 'fs';
import { resolve, join, basename, dirname } from 'path';

const aliasDir  = resolve('dist/@');
const nipsDir   = resolve('dist/nips');
const bundleDir = resolve('dist/bundle');

function getAllJsonFiles(dir) {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((ent) => {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      return getAllJsonFiles(full);
    }
    if (ent.name.endsWith('.json')) {
      return [full];
    }
    return [];
  });
}

/**
 * Remove invalid chars like "@", "-", etc. so we produce a valid JS identifier.
 */
function sanitize(str) {
  return str.replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * "kind-3" => "kind3", "client-req" => "clientReq"
 */
function camelCaseHyphens(str) {
  const parts = str.split('-').filter(Boolean);
  if (!parts.length) return '';
  const [first, ...rest] = parts;
  const lowered = first.toLowerCase();
  const appended = rest
    .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join('');
  return lowered + appended;
}

/**
 * If file base is exactly "schema", we remove it (avoid "SchemaSchema").
 * If it starts with "schema.", remove "schema." => uppercase the remainder's first letter.
 */
function processBaseName(baseName) {
  if (baseName === 'schema') {
    return '';
  }
  if (baseName.startsWith('schema.')) {
    const after = baseName.slice('schema.'.length);
    return after.charAt(0).toUpperCase() + after.slice(1);
  }
  return baseName;
}

/**
 * If the folder path includes "tag", we do special logic:
 *   - If file is "_A" => "ATagSchema"
 *   - If file is "p" => "pTagSchema"
 *   - If file is "schema" => "tagSchema"
 */
function handleTagCase(dirParts, baseName) {
  const lastDir = dirParts[dirParts.length - 1] || '';
  const secondLast = dirParts[dirParts.length - 2] || '';

  if (lastDir === 'tag' && baseName === 'schema') {
    return 'tagSchema';
  }
  if (secondLast === 'tag') {
    if (baseName === 'schema') {
      let name = lastDir;
      if (name.startsWith('_') && name.length > 1) {
        name = name.charAt(1).toUpperCase() + name.slice(2);
      }
      return name + 'TagSchema';
    } else {
      return '';
    }
  }
  if (lastDir === 'tag' && baseName) {
    if (baseName.startsWith('_') && baseName.length > 1) {
      const letter = baseName.charAt(1).toUpperCase() + baseName.slice(2);
      return letter + 'TagSchema';
    }
    return baseName + 'TagSchema';
  }

  return '';
}

/**
 * Generate exports for dist/nips
 */
function generateNipsExports(filePath) {
  const distRoot = resolve('dist');
  const relativePath = filePath.replace(distRoot, '').replace(/^[\\/]/, '');

  const baseName = basename(filePath, '.json');
  const processed = processBaseName(baseName);

  const dirParts = dirname(filePath).split(/[/\\]/).filter(Boolean);

  const tagResult = handleTagCase(dirParts, baseName);
  if (tagResult) {
    return { exportName: sanitize(tagResult), relativePath };
  }

  const parent = dirParts[dirParts.length - 1] || '';
  const parentCased = camelCaseHyphens(parent);
  let combined = parentCased + processed;
  if (!combined) {
    combined = 'Unnamed';
  }
  combined += 'Schema';

  return { exportName: sanitize(combined), relativePath };
}

/**
 * For dist/@:
 * If we have direct parent '@' => e.g. dist/@/note.json => "noteSchema" in lowercase
 * If we have a "tag" subfolder => handleTagCase
 */
function generateAliasExports(filePath) {
  const distRoot = resolve('dist');
  const relativePath = filePath.replace(distRoot, '').replace(/^[\\/]/, '');

  const baseName = basename(filePath, '.json');
  const processed = processBaseName(baseName);

  const dirParts = dirname(filePath).split(/[/\\]/).filter(Boolean);

  const last = dirParts[dirParts.length - 1] || '';
  if (last === '@') {
    const final = processed.toLowerCase() + 'Schema';
    return { exportName: sanitize(final), relativePath };
  }

  const tagResult = handleTagCase(dirParts, baseName);
  if (tagResult) {
    return { exportName: sanitize(tagResult), relativePath };
  }

  const parent = dirParts[dirParts.length - 1] || '';
  const parentCased = camelCaseHyphens(parent);
  let combined = parentCased + processed;
  if (!combined) {
    combined = 'Unnamed';
  }
  combined += 'Schema';

  return { exportName: sanitize(combined), relativePath };
}

/**
 * If two exports share the same name, keep the first (nips).
 */
function prioritizeExports(exports) {
  const seen = new Set();
  return exports.filter(({ exportName }) => {
    if (seen.has(exportName)) return false;
    seen.add(exportName);
    return true;
  });
}

function main() {
  const aliasFiles = getAllJsonFiles(aliasDir);
  const nipsFiles  = getAllJsonFiles(nipsDir);

  const aliasExports = aliasFiles.map(generateAliasExports);
  const nipsExports  = nipsFiles.map(generateNipsExports);

  const combined = prioritizeExports([...nipsExports, ...aliasExports]);

  const exportLines = combined.map(({ exportName, relativePath }) =>
    `export { default as ${exportName} } from '../${relativePath}';`
  );

  const typeLines = combined.map(({ exportName }) =>
    `declare const ${exportName}: unknown;\nexport { ${exportName} };`
  );

  if (!existsSync(bundleDir)) {
    mkdirSync(bundleDir, { recursive: true });
  }

  const schemasFile = join(bundleDir, 'schemas.js');
  const dtsFile     = join(bundleDir, 'schemas.d.ts');

  writeFileSync(schemasFile, exportLines.join('\n'));
  writeFileSync(dtsFile,   typeLines.join('\n'));

  esbuild.build({
    entryPoints: [schemasFile],
    outfile: join(bundleDir, 'schemas.bundle.js'),
    format: 'esm',
    platform: 'node',
    target: 'es2020',
    sourcemap: true,
    minify: true,
  })
  .then(() => console.log('Schemas bundled successfully!'))
  .catch(() => process.exit(1));
}

main();
