// Add explicit `.js` extensions to relative specifiers in the emitted
// declaration files.
//
// The sources use extensionless relative imports (`./network`) because they are
// bundled by rollup and loaded directly by Deno with `--unstable-sloppy-imports`.
// tsc copies those specifiers verbatim into `dist/types`. This package is
// `"type": "module"`, so a consumer that resolves types with
// `moduleResolution: node16`/`nodenext` (e.g. @nostrwatch/nostrings) treats
// `dist/types/index.d.ts` as ESM, cannot resolve `./network`, and sees none of
// the re-exported members. Rewriting only the emitted .d.ts files fixes type
// resolution without changing the sources or any runtime bundle.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const typesDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'types');

const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|^\s*import\s*)(['"])(\.{1,2}\/[^'"]*)\2/gm;

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.d.ts') ? [path] : [];
  });

const withExtension = (file, specifier) => {
  if (/\.(c|m)?js$/.test(specifier)) return specifier;
  const base = resolve(dirname(file), specifier);
  if (existsSync(`${base}.d.ts`)) return `${specifier}.js`;
  if (existsSync(join(base, 'index.d.ts'))) return `${specifier.replace(/\/$/, '')}/index.js`;
  return specifier;
};

if (!existsSync(typesDir)) {
  console.error(`fix-dts-extensions: ${typesDir} does not exist; run build:types first`);
  process.exit(1);
}

let changed = 0;
for (const file of walk(typesDir)) {
  const source = readFileSync(file, 'utf8');
  const output = source.replace(SPECIFIER, (match, prefix, quote, specifier) => {
    const next = withExtension(file, specifier);
    return next === specifier ? match : `${prefix}${quote}${next}${quote}`;
  });
  if (output !== source) {
    writeFileSync(file, output);
    changed++;
  }
}
console.log(`fix-dts-extensions: rewrote relative specifiers in ${changed} declaration file(s)`);
